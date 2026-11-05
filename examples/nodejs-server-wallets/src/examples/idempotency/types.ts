/**
 * Idempotency Demo — Shared Contract
 *
 * Chain-agnostic options only. Each chain's demo lives in its own module
 * (`evm.ts`, `svm.ts`) and `index.ts` dispatches between them, so nothing here
 * may import chain-specific code.
 */

/** Options every chain's demo accepts, parsed once by the dispatcher. */
export interface IdempotencyDemoOptions {
  /** The idempotency key. Re-running with the same one must not execute twice. */
  orderId: string;
  /** Wallet to use. A new one is created when omitted. */
  address?: string;
  password?: string;
  /**
   * Bypass the bookkeeping layer and deliberately attempt a second execution.
   *
   * What that proves differs by chain, because the backstop differs: EVM has an
   * on-chain nonce bitmap that rejects the replay, SVM has nothing equivalent and
   * the second execution actually lands.
   */
  force: boolean;
  /** EVM only — whole USDC to mint. SVM has no free-mint equivalent. */
  amount?: number;
}
