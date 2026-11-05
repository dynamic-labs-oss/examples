/**
 * Unified Transfer — Shared Contract
 *
 * Chain-agnostic types only. Each chain implements this contract in its own
 * adapter (`transfer/evm.ts`, `transfer/svm.ts`) and `transfer/index.ts`
 * dispatches between them, so nothing here may import chain-specific code — that
 * would re-couple the chains this split exists to separate.
 *
 * The SDK client types below are the one exception, and they are unavoidable:
 * `TransferClients` has to name the concrete clients it accepts. They are
 * type-only imports of vendor types, not of this repo's chain modules.
 */

import type { ServerKeyShare, WalletMetadata } from "@dynamic-labs-wallet/node";
import type {
  DelegatedEvmWalletClient,
  DynamicEvmWalletClient,
} from "@dynamic-labs-wallet/node-evm";
import type {
  DelegatedSvmWalletClient,
  DynamicSvmWalletClient,
} from "@dynamic-labs-wallet/node-svm";

import type { DelegatedCredentialsBase } from "../delegated-credentials";

/**
 * Chains the transfer layer supports.
 *
 * Adding one: append it here, give it a `NATIVE_DECIMALS` entry, write a
 * `transfer/<chain>.ts` adapter, and register it in `transfer/index.ts`. The dispatch
 * switch uses an exhaustiveness check, so TypeScript fails the build at each site
 * that still needs updating.
 */
export const SUPPORTED_CHAINS = ["evm", "svm"] as const;

/** A chain this layer can transfer on. */
export type ChainKind = (typeof SUPPORTED_CHAINS)[number];

/**
 * Native asset decimals per chain — fixed protocol constants (wei, lamports),
 * not lookups. Token decimals are read from the chain; see `token/evm.ts` / `token/svm.ts`.
 */
export const NATIVE_DECIMALS: Record<ChainKind, number> = { evm: 18, svm: 9 };

/** Thrown when a chain isn't supported — at a boundary or via a bad cast. */
export class UnsupportedChainError extends Error {
  constructor(chain: string) {
    super(
      `Chain not supported: "${chain}". Supported chains: ${SUPPORTED_CHAINS.join(", ")}.`,
    );
    this.name = "UnsupportedChainError";
  }
}

/**
 * Exhaustiveness guard for `switch (chain)` defaults.
 *
 * The `never` parameter makes an unhandled `ChainKind` a compile error; the throw
 * covers values reaching here at runtime despite the types (unvalidated input, a
 * cast, JSON from a datastore).
 */
export function assertUnsupportedChain(chain: never): never {
  throw new UnsupportedChainError(String(chain));
}

/** Same guard, for `switch (signer.kind)` defaults. */
export function assertUnsupportedSigner(signer: never): never {
  throw new Error(
    `Signer kind not supported: ${JSON.stringify((signer as { kind?: string })?.kind)}`,
  );
}

/**
 * Lifecycle states. `submitted` is reserved for a relay-status passthrough; the
 * adapters here go straight from `pending` to `success` or `failure`.
 */
export type TransferStatus = "pending" | "submitted" | "success" | "failure";

/**
 * One transfer attempt, keyed by its idempotency key.
 *
 * Declared here rather than in `store.ts` so `chain` can be `ChainKind` — a
 * hand-written `"evm" | "svm"` union would let a newly added chain slip past the
 * store, and the error would point at persistence rather than at the adapter that
 * needs writing. The store owns reading and writing these; the shape belongs to
 * the contract.
 */
export interface TransferRecord {
  key: string;
  chain: ChainKind;
  status: TransferStatus;
  from: string;
  to: string;
  /** Transaction hash (EVM) or signature (SVM), once known. */
  transactionId?: string;
  /** EVM: the derived intent nonce, as a decimal string. */
  nonce?: string;
  /** EVM: relay request id, for status polling. */
  requestId?: string;
  /** SVM: base64 signed transaction, replayed verbatim on retry. */
  signedTransaction?: string;
  createdAt: string;
}

/** What to move: the chain's native asset, or a fungible token. */
export type Asset =
  | { kind: "native" }
  | {
      kind: "token";
      /** ERC-20 contract address, or SPL mint address. */
      address: string;
      /**
       * Optional. Omit it and the adapter reads the authoritative value from the
       * token contract / mint account.
       *
       * Supply it only as an assertion: it is checked against the on-chain value
       * and a mismatch throws. Guessing wrong misvalues the transfer by orders of
       * magnitude, so it is never trusted blindly.
       */
      decimals?: number;
    };

/** How the transfer is authorised. */
export type TransferSigner =
  | {
      kind: "server";
      walletMetadata: WalletMetadata;
      externalServerKeyShares?: ServerKeyShare[];
      password?: string;
    }
  | {
      kind: "delegated";
      /**
       * The shared credential shape. Each adapter narrows it to its own chain's
       * type — EVM's differs only in typing `address` as `Hex`.
       *
       * Deliberately not a union of the two chain types: a union would make this
       * "chain-agnostic" contract import both chain modules, and being
       * undiscriminated it would not prevent passing EVM credentials with
       * `chain: "svm"` anyway.
       */
      credentials: DelegatedCredentialsBase;
    };

/** Clients for the chain in play. Only the matching pair is required. */
export interface TransferClients {
  evmClient?: DynamicEvmWalletClient;
  evmDelegatedClient?: DelegatedEvmWalletClient;
  svmClient?: DynamicSvmWalletClient;
  svmDelegatedClient?: DelegatedSvmWalletClient;
}

/** Everything needed to perform one transfer, on any supported chain. */
export interface TransferRequest {
  /**
   * Stable identifier for this operation, so a retry resolves the prior attempt
   * instead of starting a new one.
   *
   * **Read the guarantee precisely, because it differs by chain.** On EVM it is
   * strong: the key derives the intent nonce, and the delegate contract's bitmap
   * admits that nonce once per wallet — concurrent workers included. On SVM there
   * is no on-chain backstop, and nothing here reserves the key before work starts,
   * so two workers holding the same key will both build (with different
   * blockhashes), both sign, and both land. Getting SVM concurrency right requires
   * your datastore to insert-if-absent *before* signing; the file-backed store in
   * `store.ts` is a demo and does not.
   */
  idempotencyKey: string;
  chain: ChainKind;
  signer: TransferSigner;
  clients: TransferClients;
  /** Sender address — must match the signer's wallet. */
  from: string;
  to: string;
  /** Decimal string, e.g. "1.5". Never a float: precision matters here. */
  amount: string;
  asset: Asset;
  rpcUrl?: string;
}

/** Outcome of a transfer, including whether this call actually executed it. */
export interface TransferResult {
  chain: ChainKind;
  /** Transaction hash (EVM) or signature (SVM). */
  transactionId: string;
  explorerUrl: string;
  /** Base units actually moved. */
  amountBaseUnits: bigint;
  /**
   * False when a prior attempt under this key had already been dispatched, so
   * this call was a no-op.
   */
  executed: boolean;
}

/** Everything an adapter needs beyond the request itself. */
export interface TransferExecution {
  amountBaseUnits: bigint;
  decimals: number;
  /** Prior attempt under this key, if any. SVM replays its signed bytes. */
  prior?: TransferRecord;
}

/**
 * The contract each chain implements.
 *
 * Keeping decimals resolution here — rather than in the dispatcher — lets each
 * chain own how it reads token metadata, which is the part that genuinely differs.
 */
export interface ChainTransferAdapter {
  /** Scale factor for the amount: native constant, or read from the token. */
  resolveDecimals(request: TransferRequest): Promise<number>;
  /** Build, sign, and submit. Owns its own idempotency mechanism. */
  transfer(
    request: TransferRequest,
    execution: TransferExecution,
  ): Promise<TransferResult>;
  /** Block explorer link for a transaction hash / signature on this chain. */
  explorerUrl(transactionId: string): string;
}

/** Narrow an optional client to a required one, naming what's missing. */
export function requireClient<T>(client: T | undefined, name: string): T {
  if (!client) {
    throw new Error(`clients.${name} is required for this chain and signer`);
  }
  return client;
}

/**
 * Verify a caller-supplied decimals value against the chain's.
 *
 * A mismatch is refused rather than reconciled: silently preferring either value
 * would move the wrong amount, and the factor is what makes the mistake obvious.
 */
export function assertDecimalsMatch({
  address,
  asserted,
  onChain,
}: {
  address: string;
  asserted: number | undefined;
  onChain: number;
}): number {
  if (asserted !== undefined && asserted !== onChain) {
    throw new Error(
      `Token decimals mismatch for ${address}: caller said ${asserted}, chain ` +
        `reports ${onChain}. Refusing to transfer — this would move ` +
        `${asserted > onChain ? "more" : "less"} than intended by a factor of ` +
        `1e${Math.abs(asserted - onChain)}.`,
    );
  }

  return onChain;
}
