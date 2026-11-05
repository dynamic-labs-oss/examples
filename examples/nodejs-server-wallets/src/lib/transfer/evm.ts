/**
 * EVM Transfer Adapter
 *
 * Implements `ChainTransferAdapter` for EVM. Imports only EVM dependencies — the
 * SVM adapter is a sibling and the two never reference each other.
 *
 * ## Idempotency on EVM
 *
 * The guarantee lives in the **intent nonce**, derived from `idempotencyKey`. The
 * delegate contract tracks spent nonces in a bitmap, so a given nonce is
 * consumable exactly once per wallet — every retry reproduces the same nonce and
 * the chain admits at most one. Nothing needs persisting for correctness; the
 * record is written for observability and to make retries cheap.
 *
 * This also survives re-signing, which matters because intents expire after 10
 * minutes and a long retry window forces a re-sign. Contrast `transfer/svm.ts`,
 * where rebuilding is what double-executes. See IDEMPOTENCY.md.
 */

import { encodeFunctionData, erc20Abi, type Hex } from "viem";

import { DEFAULT_CHAIN, evmRpcUrl } from "../../../constants";
import {
  deriveIdempotencyNonce,
  type DelegatedCredentials,
  sendDelegatedSponsoredTransaction,
  sendSponsoredTransaction,
} from "../gasless/evm";
import { readEvmTokenDecimals } from "../token/evm";
import { patchTransfer, putTransfer } from "./store";
import {
  assertDecimalsMatch,
  assertUnsupportedSigner,
  type ChainTransferAdapter,
  NATIVE_DECIMALS,
  requireClient,
  type TransferExecution,
  type TransferRequest,
  type TransferResult,
} from "./types";
import { getTransactionLink } from "../utils";

/** A single `{ target, data, value }` call in a sponsored intent. */
interface SponsoredCall {
  target: Hex;
  data: Hex;
  value: bigint;
}

/** EVM implementation of the transfer contract. */
export const evmTransferAdapter: ChainTransferAdapter = {
  resolveDecimals,
  transfer,
  explorerUrl: getTransactionLink,
};

async function resolveDecimals(request: TransferRequest): Promise<number> {
  if (request.asset.kind === "native") return NATIVE_DECIMALS.evm;

  const publicClient = requireClient(
    request.clients.evmClient,
    "evmClient",
  ).createViemPublicClient({
    chain: DEFAULT_CHAIN,
    rpcUrl: request.rpcUrl ?? evmRpcUrl(),
  });

  const onChain = await readEvmTokenDecimals(
    publicClient,
    request.asset.address as Hex,
  );

  return assertDecimalsMatch({
    address: request.asset.address,
    asserted: request.asset.decimals,
    onChain,
  });
}

async function transfer(
  request: TransferRequest,
  { amountBaseUnits }: TransferExecution,
): Promise<TransferResult> {
  const nonce = deriveIdempotencyNonce(request.idempotencyKey);
  const calls = [buildCall(request, amountBaseUnits)];

  putTransfer({
    key: request.idempotencyKey,
    chain: "evm",
    status: "pending",
    from: request.from,
    to: request.to,
    nonce: String(nonce),
    createdAt: new Date().toISOString(),
  });

  const { transactionHash } = await relay(request, calls, nonce);

  // Record the hash before confirming, so a crash during the receipt wait still
  // leaves something to resolve the operation with.
  patchTransfer(request.idempotencyKey, { transactionId: transactionHash });

  // Settle from the receipt, not from the relay.
  //
  // The relay reports **delivery**: `waitForSponsoredTransaction` resolves as soon
  // as a hash exists, at relay status `submitted`, before mining — and it says
  // nothing about whether the calls reverted. Writing `success` on that basis puts
  // a terminal, immutable record (see `putTransfer`) on an operation that may have
  // failed, permanently burning the idempotency key.
  const publicClient = requireClient(
    request.clients.evmClient,
    "evmClient",
  ).createViemPublicClient({
    chain: DEFAULT_CHAIN,
    rpcUrl: request.rpcUrl ?? evmRpcUrl(),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });

  if (receipt.status !== "success") {
    patchTransfer(request.idempotencyKey, { status: "failure" });
    throw new Error(
      `Transfer ${transactionHash} was delivered but reverted on-chain. The ` +
        `intent nonce for "${request.idempotencyKey}" is now spent, so this key ` +
        `cannot be retried — resolve it from business state.`,
    );
  }

  patchTransfer(request.idempotencyKey, { status: "success" });

  return {
    chain: "evm",
    transactionId: transactionHash,
    explorerUrl: getTransactionLink(transactionHash),
    amountBaseUnits,
    executed: true,
  };
}

/**
 * Relay the intent using whichever signer the caller supplied.
 *
 * Both paths take the same `calls` and `nonce`, so the idempotency guarantee is
 * identical either way. The default is an exhaustiveness guard: adding a signer
 * kind fails the build here rather than falling into the wrong branch.
 */
async function relay(
  request: TransferRequest,
  calls: SponsoredCall[],
  nonce: bigint,
): Promise<{ transactionHash: Hex }> {
  const evmClient = requireClient(request.clients.evmClient, "evmClient");
  const rpcUrl = request.rpcUrl ?? evmRpcUrl();
  const signer = request.signer;

  switch (signer.kind) {
    case "server":
      return sendSponsoredTransaction({
        evmClient,
        walletMetadata: signer.walletMetadata,
        externalServerKeyShares: signer.externalServerKeyShares,
        password: signer.password,
        calls,
        nonce,
        rpcUrl,
      });

    case "delegated":
      return sendDelegatedSponsoredTransaction({
        delegatedClient: requireClient(
          request.clients.evmDelegatedClient,
          "evmDelegatedClient",
        ),
        credentials: signer.credentials as DelegatedCredentials,
        calls,
        nonce,
        rpcUrl,
      });

    default:
      return assertUnsupportedSigner(signer);
  }
}

/** Native transfer is a plain value call; a token transfer is ERC-20 calldata. */
function buildCall(request: TransferRequest, amount: bigint): SponsoredCall {
  if (request.asset.kind === "native") {
    return { target: request.to as Hex, data: "0x", value: amount };
  }

  return {
    target: request.asset.address as Hex,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [request.to as Hex, amount],
    }),
    value: 0n,
  };
}
