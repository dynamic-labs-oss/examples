/**
 * Idempotent Sponsored Transaction — EVM
 *
 * On EVM the idempotency key is the **intent nonce**, and it can be derived from
 * a business key. That is what makes this the easier of the two chains.
 *
 * ## The problem
 *
 * `sendSponsoredTransaction` generates a fresh random intent nonce on every call
 * when you don't supply one. Two calls describing the same logical operation are
 * therefore two *different* intents — and both can land on-chain. Any retry loop
 * around the default call path can double-spend.
 *
 * This is easy to hit by accident: `waitForSponsoredTransaction` throws after 60
 * seconds, but a timeout is **not** a failure — the relayer may still land the
 * transaction. Retrying on that throw is the most likely route to double
 * execution.
 *
 * ## The two defences, layered
 *
 * 1. **A derived nonce.** The delegate contract tracks spent nonces in a bitmap,
 *    so a nonce can be consumed exactly once per wallet. Deriving it from an order
 *    ID means every retry produces the same nonce, and the chain itself admits at
 *    most one. This survives re-signing, which matters because intents expire.
 *
 * 2. **A persisted `requestId`.** Before relaying again, ask what happened to the
 *    previous attempt. This avoids spending a relay at all, and is how you tell
 *    "timed out but succeeded" from "genuinely failed".
 *
 * Layer 2 is the fast path; layer 1 is what saves you when layer 2 is unavailable
 * (process crashed before the write, cache lost, two workers racing).
 *
 * ## What this demo does
 *
 * Mints test USDC — an operation with a visible effect, so a double execution
 * would show up as double the balance. It reads the balance before and after and
 * reports the delta.
 */

import { deriveIdempotencyNonce } from "../../lib/gasless/evm";
import { encodeFunctionData, erc20Abi, type Hex } from "viem";

import { CONTRACTS, DEFAULT_CHAIN, evmRpcUrl, TOKEN_ABI, USDC_DECIMALS } from "../../../constants";
import { authenticatedEvmClient, type EvmClient } from "../../lib/clients/evm";
import { getTransfer, patchTransfer, putTransfer } from "../../lib/transfer/store";
import { getTransactionLink } from "../../lib/utils";
import { getOrCreateWallet, type WalletInfo } from "../../lib/wallet-helpers";
import type { IdempotencyDemoOptions } from "./types";

const USDC_ADDRESS = CONTRACTS[DEFAULT_CHAIN.id].USDC;
const DEFAULT_AMOUNT = 10;

/** Terminal states — anything else may still land and must not be retried. */
const TERMINAL_FAILURE = "failure";
const TERMINAL_SUCCESS = "success";

async function readUsdcBalance(
  evmClient: EvmClient,
  address: string,
  blockNumber?: bigint,
): Promise<bigint> {
  const publicClient = evmClient.createViemPublicClient({
    chain: DEFAULT_CHAIN,
    rpcUrl: evmRpcUrl(),
  });

  return publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Hex],
    // Pinning matters after a relay: reading at `latest` can hit a node that is a
    // block or two behind the one that served the receipt, which reports the
    // pre-mint balance and prints "Delta this run: 0" for a mint that did land.
    // The delta is this demo's whole point, so a wrong number is worse than none.
    ...(blockNumber !== undefined && { blockNumber }),
  });
}

const formatUsdc = (units: bigint) =>
  `${Number(units) / 10 ** USDC_DECIMALS} USDC`;

/**
 * Step 1: has this operation already been dispatched?
 *
 * Returns the transaction hash when the prior attempt succeeded, so the caller
 * can skip relaying entirely. Returns null when there's nothing usable and a
 * relay should proceed.
 */
async function resolvePriorAttempt(
  evmClient: EvmClient,
  orderId: string,
): Promise<Hex | null> {
  const prior = getTransfer(orderId);
  if (!prior) {
    console.info(`No prior attempt recorded for "${orderId}"`);
    return null;
  }

  // A record without a requestId was written before the relay returned (or by a
  // chain that has no relay), so there is nothing to poll — treat it as no attempt.
  if (!prior.requestId) {
    console.info(`Prior record for "${orderId}" has no requestId — relaying.`);
    return null;
  }

  console.info(`Found prior attempt for "${orderId}"`);
  console.info(`  requestId: ${prior.requestId}`);
  console.info(`  Checking its status before relaying anything...`);

  const { status, transactionHash, errorMessage } =
    await evmClient.getEVMSponsoredTransactionStatus({
      requestId: prior.requestId,
    });

  patchTransfer(orderId, {
    status,
    ...(transactionHash && { transactionId: transactionHash }),
  });
  console.info(`  Status: ${status}`);

  // A hash means the relay broadcast it, which is enough to stop us relaying
  // again — the caller confirms the receipt. Note the relay can sit on
  // `submitted` well after the transaction is mined, so requiring `success` here
  // would cause needless re-relays.
  if (transactionHash) {
    return transactionHash;
  }

  if (status === TERMINAL_FAILURE) {
    // Safe to retry: the relay reached a terminal failure, so nothing landed.
    // The same nonce is reused below, so even a wrong call here can't double-spend.
    console.info(`  Previous attempt failed (${errorMessage ?? "no message"})`);
    console.info(`  Retrying with the same nonce...`);
    return null;
  }

  // pending / submitted: in flight. Waiting is correct — relaying again would
  // be redundant at best.
  console.info(`  Still in flight. Waiting for it rather than relaying again...`);
  const result = await evmClient.waitForSponsoredTransaction({
    requestId: prior.requestId,
  });
  patchTransfer(orderId, { transactionId: result.transactionHash });
  return result.transactionHash;
}

/**
 * Wait for the transaction to actually be mined, then settle the stored status.
 *
 * This step is not optional. `waitForSponsoredTransaction` returns as soon as a
 * hash exists — at relay status `submitted` — so reading contract state straight
 * afterwards can observe pre-transaction values. Confirming the receipt is also
 * the only way to learn whether the calls *succeeded* or reverted; the relay
 * reports delivery, not execution.
 *
 * Returns the block the transaction landed in, so a caller reading contract state
 * afterwards can pin the read to it instead of racing `latest`.
 */
async function confirmAndSettle(
  evmClient: EvmClient,
  orderId: string,
  transactionHash: Hex,
): Promise<bigint> {
  const publicClient = evmClient.createViemPublicClient({
    chain: DEFAULT_CHAIN,
    rpcUrl: evmRpcUrl(),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });
  const succeeded = receipt.status === "success";

  patchTransfer(orderId, {
    status: succeeded ? TERMINAL_SUCCESS : TERMINAL_FAILURE,
    transactionId: transactionHash,
  });

  console.info(`Receipt: ${receipt.status} (block ${receipt.blockNumber})`);
  return receipt.blockNumber;
}

/**
 * Step 2: relay the intent under a nonce derived from the order ID.
 *
 * Split into relay + wait rather than using the combined send, so the requestId
 * is persisted before we start waiting. If this process dies mid-wait, the next
 * run finds the requestId and asks about it instead of re-sending.
 */
async function relayWithDerivedNonce(
  evmClient: EvmClient,
  wallet: WalletInfo,
  orderId: string,
  amount: number,
  password?: string,
): Promise<Hex> {
  const nonce = deriveIdempotencyNonce(orderId);
  console.info(`\nDerived nonce from "${orderId}":`);
  console.info(`  ${nonce}`);
  console.info(`  (stable across retries — the contract admits it once)`);

  const calls = [
    {
      target: USDC_ADDRESS as Hex,
      data: encodeFunctionData({
        abi: TOKEN_ABI,
        functionName: "mint",
        args: [BigInt(amount)],
      }),
      value: 0n,
    },
  ];

  const { requestId } = await evmClient.relaySponsoredTransaction({
    walletMetadata: wallet.walletMetadata,
    ...(wallet.externalServerKeyShares.length > 0 && {
      externalServerKeyShares: wallet.externalServerKeyShares,
    }),
    calls,
    chainId: DEFAULT_CHAIN.id,
    rpcUrl: evmRpcUrl(),
    nonce,
    ...(password && { password }),
  });

  // Persist before waiting — see the note above.
  putTransfer({
    key: orderId,
    chain: "evm",
    status: "pending",
    from: wallet.address,
    to: wallet.address,
    requestId,
    nonce: String(nonce),
    createdAt: new Date().toISOString(),
  });
  console.info(`\nRelayed. requestId: ${requestId} (persisted)`);

  try {
    const { transactionHash } = await evmClient.waitForSponsoredTransaction({
      requestId,
    });
    // Only the hash is recorded here, deliberately not a success status.
    // `waitForSponsoredTransaction` resolves as soon as a hash exists — which
    // happens at relay status `submitted`, before the transaction is mined. The
    // caller confirms the receipt and settles the status from on-chain truth.
    patchTransfer(orderId, { transactionId: transactionHash });
    return transactionHash;
  } catch (error) {
    // Record the terminal failure so the next run doesn't sit waiting on a dead
    // request. Note a *timeout* is not terminal — the relay may still land it —
    // which is why the status is only written when the relay itself reports
    // failure.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("relay failed")) {
      patchTransfer(orderId, { status: TERMINAL_FAILURE });
    }
    throw error;
  }
}

/** Run the EVM demo. Called by the dispatcher in `index.ts`. */
export async function runEvmIdempotencyDemo({
  orderId,
  address,
  password,
  force,
  amount = DEFAULT_AMOUNT,
}: IdempotencyDemoOptions): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) {
    console.error(`--amount must be a positive integer (got: ${amount})`);
    process.exit(1);
  }

  console.info(`Mint amount: ${amount} USDC`);
  console.info("=".repeat(60));
  console.info("");

  const evmClient = await authenticatedEvmClient();

  // The already-executed check runs before any wallet is resolved, and short-
  // circuits without one. It needs only the stored `requestId`.
  //
  // Resolving a wallet first would be actively misleading: with `--address`
  // omitted this creates a *fresh* wallet, then reports that wallet's balance and
  // delta for an operation belonging to a different address — turning the demo's
  // central evidence into noise.
  if (!force) {
    const priorHash = await resolvePriorAttempt(evmClient, orderId);

    if (priorHash) {
      console.info(`\nAlready executed — skipping relay entirely.`);
      console.info("");
      await confirmAndSettle(evmClient, orderId, priorHash);

      const priorFrom = getTransfer(orderId)?.from;
      const balance = priorFrom
        ? await readUsdcBalance(evmClient, priorFrom)
        : undefined;

      console.info("");
      console.info("=".repeat(60));
      console.info(`Transaction: ${priorHash}`);
      console.info(`Explorer: ${getTransactionLink(priorHash)}`);
      console.info(`Relayed this run: no`);
      if (balance !== undefined) {
        console.info(`Balance after: ${formatUsdc(balance)}`);
      }
      console.info(`Delta this run: ${formatUsdc(0n)}`);
      console.info("");
      if (priorFrom) console.info(`Wallet: ${priorFrom}`);
      console.info(
        `Re-run with --order-id ${orderId} — the balance should not move again.`,
      );
      console.info("=".repeat(60));
      return;
    }
  }

  // Always reuse the prior attempt's wallet, on every path.
  //
  // The nonce bitmap is **per-wallet**, so relaying the same derived nonce from a
  // *different* wallet gets no protection from it at all: the first intent may have
  // landed on wallet A while the retry lands on wallet B — one order id, two
  // executions, which is the exact failure this file exists to prevent. That makes
  // the docblock's "layer 1 saves you when layer 2 is unavailable" claim true only
  // if the wallet is held fixed.
  //
  // If the prior wallet was ephemeral the lookup fails with an actionable message,
  // which is better than silently proving the wrong thing.
  const priorFrom = getTransfer(orderId)?.from;
  const walletAddress = address ?? priorFrom;

  if (!address && priorFrom) {
    console.info(`Reusing the prior attempt's wallet: ${priorFrom}`);
  }

  const wallet = await getOrCreateWallet(evmClient, walletAddress, password);

  const balanceBefore = await readUsdcBalance(evmClient, wallet.address);
  console.info(`\nBalance before: ${formatUsdc(balanceBefore)}`);
  console.info("");

  let transactionHash: Hex | null = null;
  let executed = false;

  if (force) {
    console.info(
      `--force: skipping the requestId check and relaying a second`,
    );
    console.info(
      `intent with the same nonce. The bitmap should reject it on-chain.`,
    );
    try {
      transactionHash = await relayWithDerivedNonce(
        evmClient,
        wallet,
        orderId,
        amount,
        password,
      );
      executed = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Only an on-chain rejection proves the point. A timeout emphatically does
      // not: per the docblock above, the relay may still land the transaction, so
      // reporting "rejected as intended" there would teach the opposite of the
      // truth in exactly the case where a second execution is still in flight.
      const rejectedOnChain =
        message.includes("relay failed") ||
        message.includes("SMART_CONTRACT_EXECUTION_FAILED");

      if (!rejectedOnChain) {
        console.error(`\nThe second relay did not reach an on-chain rejection.`);
        console.error(
          `This is NOT proof the bitmap worked — a timeout means the transaction`,
        );
        console.error(`may still land. Treat the outcome as unknown.`);
        throw error;
      }

      // A spent nonce means "already executed", which is success for idempotency.
      console.info(`\nSecond relay rejected on-chain, as intended:`);
      console.info(`  ${message}`);
    }
  } else {
    // The prior-attempt check already ran above and found nothing usable, so
    // there is nothing left to do but relay under the derived nonce.
    transactionHash = await relayWithDerivedNonce(
      evmClient,
      wallet,
      orderId,
      amount,
      password,
    );
    executed = true;
  }

  // Confirm on-chain before reading state — see confirmAndSettle().
  let settledBlock: bigint | undefined;
  if (transactionHash) {
    console.info("");
    settledBlock = await confirmAndSettle(evmClient, orderId, transactionHash);
  }

  const balanceAfter = await readUsdcBalance(
    evmClient,
    wallet.address,
    settledBlock,
  );
  const delta = balanceAfter - balanceBefore;

  console.info("");
  console.info("=".repeat(60));
  if (transactionHash) {
    console.info(`Transaction: ${transactionHash}`);
    console.info(`Explorer: ${getTransactionLink(transactionHash)}`);
  }
  console.info(`Relayed this run: ${executed ? "yes" : "no"}`);
  console.info(`Balance after: ${formatUsdc(balanceAfter)}`);
  console.info(`Delta this run: ${formatUsdc(delta)}`);
  console.info("");
  console.info(`Wallet: ${wallet.address}`);
  console.info(
    `Re-run with --order-id ${orderId} — the balance should not move again.`,
  );
  console.info("=".repeat(60));
}
