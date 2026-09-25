/**
 * Unified Idempotent Gasless Transfer
 *
 * One call shape for sending value gaslessly, whether the wallet is on EVM or SVM,
 * whether it holds a server wallet's key shares or a user's delegated credentials,
 * and whether it's moving the native asset or a fungible token:
 *
 *   const result = await sendGaslessTransfer({
 *     idempotencyKey: `order:${orderId}`,
 *     chain: "evm",                       // or "svm"
 *     signer: { kind: "server", walletMetadata, externalServerKeyShares },
 *     clients: { evmClient },
 *     from, to,
 *     amount: "1.5",                      // decimal string, never a float
 *     asset: { kind: "native" },          // or { kind: "token", address }
 *   });
 *
 * Retrying with the same `idempotencyKey` never executes twice.
 *
 * ## Why this layer exists
 *
 * The two chains are not variations on one design — they need opposite handling,
 * and getting either wrong double-spends:
 *
 * | | EVM | SVM |
 * | --- | --- | --- |
 * | Sponsorship | Signed intent relayed by Dynamic | Fee payer swapped, you broadcast |
 * | Idempotency unit | Derived bitmap nonce | The signed bytes |
 * | Safe to re-sign? | Yes, if the nonce is pinned | **Never** |
 *
 * See IDEMPOTENCY.md for the measurements behind that table.
 *
 * ## Structure
 *
 * This file is only the dispatcher. Each chain lives in its own adapter, matching
 * how the rest of the codebase separates chains:
 *
 *   transfer/types.ts  shared contract (no chain imports)
 *   transfer/evm.ts    EVM adapter
 *   transfer/svm.ts    SVM adapter
 *   transfer/store.ts  idempotency records
 *   transfer/index.ts  dispatch  <- you are here
 *
 * Adding a chain: write `transfer/<chain>.ts`, append to `SUPPORTED_CHAINS`, add a
 * `NATIVE_DECIMALS` entry, and add a `case` below. The switch is exhaustiveness
 * checked, so TypeScript fails the build at each site still needing work.
 *
 * ## Limits
 *
 * - Fungible transfers only (native, ERC-20, SPL). No arbitrary contract calls —
 *   use the chain-specific helpers for that.
 * - SPL transfers require the recipient's associated token account to already
 *   exist; sponsorship covers fees, not account rent.
 */

import { parseUnits } from "viem";

import { getTransfer } from "./store";
import { evmTransferAdapter } from "./evm";
import { svmTransferAdapter } from "./svm";
import {
  assertUnsupportedChain,
  type ChainKind,
  type ChainTransferAdapter,
  type TransferRequest,
  type TransferResult,
} from "./types";

// Re-exported so callers need only import from `transfer`. Kept to what callers
// actually use — see `./types` for the full contract.
export {
  assertUnsupportedChain,
  type Asset,
  type ChainKind,
  SUPPORTED_CHAINS,
  type TransferClients,
  type TransferSigner,
} from "./types";

/** Select the adapter for a chain. */
function adapterFor(chain: ChainKind): ChainTransferAdapter {
  switch (chain) {
    case "evm":
      return evmTransferAdapter;
    case "svm":
      return svmTransferAdapter;
    default:
      return assertUnsupportedChain(chain);
  }
}

/**
 * Send a gasless transfer, idempotently, on any supported chain.
 *
 * The dispatcher owns only what is genuinely chain-agnostic: picking the adapter,
 * scaling the amount, and short-circuiting an already-settled key. Everything that
 * differs per chain — how decimals are read, how the transaction is built and
 * signed, and how idempotency is enforced — belongs to the adapter.
 */
export async function sendGaslessTransfer(
  request: TransferRequest,
): Promise<TransferResult> {
  const adapter = adapterFor(request.chain);

  const decimals = await adapter.resolveDecimals(request);
  const amountBaseUnits = parseUnits(request.amount, decimals);

  if (amountBaseUnits <= 0n) {
    throw new Error(
      `Amount must be greater than zero (got "${request.amount}")`,
    );
  }

  // A settled record short-circuits every chain — the cheapest possible retry.
  const prior = getTransfer(request.idempotencyKey);
  if (prior?.status === "success" && prior.transactionId) {
    return {
      chain: request.chain,
      transactionId: prior.transactionId,
      explorerUrl: adapter.explorerUrl(prior.transactionId),
      amountBaseUnits,
      executed: false,
    };
  }

  return adapter.transfer(request, { amountBaseUnits, decimals, prior });
}
