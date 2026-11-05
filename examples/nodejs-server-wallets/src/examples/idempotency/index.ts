#!/usr/bin/env tsx

/**
 * Idempotent Sponsored Transaction — Dispatcher
 *
 * How to retry a gas-sponsored transaction without risking double execution, on
 * either chain. Each chain's mechanism lives in its own module, because they share
 * almost nothing:
 *
 *   evm.ts - the idempotency key is the intent **nonce**, derivable from a business
 *            key, enforced by an on-chain bitmap. Retries are safe even after a
 *            re-sign.
 *   svm.ts - the idempotency key is the **signed bytes**. Solana dedupes identical
 *            transaction ids, but nothing dedupes "the same logical operation":
 *            rebuilding takes a fresh blockhash, which changes the message and
 *            hence the id, and executes again. So persist the bytes and replay
 *            them verbatim rather than rebuilding.
 *
 * The full reasoning, with measurements, is in IDEMPOTENCY.md. For real work prefer
 * the unified layer (`pnpm example:transfer`), which picks the right mechanism for
 * you; this example exists to make each mechanism legible.
 *
 * ## Usage
 *
 *   pnpm example:idempotency --order-id order-123                    # EVM (default)
 *   pnpm example:idempotency --order-id order-123                    # again: no-op
 *   pnpm example:idempotency --order-id order-123 --force            # bypass bookkeeping
 *
 *   pnpm example:idempotency --chain svm --order-id order-456        # first run: executes
 *   pnpm example:idempotency --chain svm --order-id order-456        # again: replays bytes
 *   pnpm example:idempotency --chain svm --order-id order-456 --force
 *
 * `--force` skips the bookkeeping layer and deliberately attempts a second
 * execution. What that proves differs by chain, and the difference is the lesson:
 * EVM's nonce bitmap **rejects** the replay on-chain, while on SVM the second
 * transaction **lands** — there is no equivalent backstop.
 */

import { parseArgs, runScript } from "../../lib/cli";
import { getTransfer } from "../../lib/transfer/store";
import {
  assertUnsupportedChain,
  type ChainKind,
  SUPPORTED_CHAINS,
} from "../../lib/transfer/types";
import { runEvmIdempotencyDemo } from "./evm";
import { runSvmIdempotencyDemo } from "./svm";
import type { IdempotencyDemoOptions } from "./types";

function showUsage(): never {
  console.error("\nUsage:");
  console.error("  pnpm example:idempotency --order-id order-123");
  console.error("  pnpm example:idempotency --order-id order-123 --force");
  console.error("  pnpm example:idempotency --chain svm --order-id order-456");
  console.error("\nFlags:");
  console.error("  --chain     evm (default) or svm");
  console.error("  --order-id  required. The idempotency key");
  console.error("  --force     attempt a second execution, bypassing bookkeeping");
  console.error("  --amount    EVM only. Whole USDC to mint (default 10)");
  console.error("  --address   wallet to use. A new one is created when omitted");
  console.error("  --password  for password-protected wallets");
  process.exit(1);
}

/**
 * Refuse a key already used on the other chain.
 *
 * The store is keyed by order id alone, so reusing one across chains would have
 * each demo reading a record it cannot interpret — an SVM record has no
 * `requestId`, an EVM record has no signed bytes. Both would silently fall through
 * to "no prior attempt" and execute again, which is precisely the bug this example
 * is about. Better to stop.
 */
function assertKeyNotUsedOnOtherChain(orderId: string, chain: ChainKind): void {
  const prior = getTransfer(orderId);
  if (!prior || prior.chain === chain) return;

  console.error(
    `Order id "${orderId}" already has a ${prior.chain.toUpperCase()} record in the store.`,
  );
  console.error(
    `Idempotency keys are per-operation, and the two chains persist different`,
  );
  console.error(
    `things, so the same key cannot be reused across chains. Pick another --order-id.`,
  );
  process.exit(1);
}

/**
 * Refuse `--force` when there is nothing to force a *second* attempt against.
 *
 * With no prior attempt the flag doesn't demonstrate its lesson — it just executes
 * once, and misleadingly:
 *
 *   EVM - a fresh wallet's nonce bitmap is unspent, so the "second" relay succeeds
 *         and the output claims the bitmap should have rejected it.
 *   SVM - the force path deliberately persists nothing, so the run leaves no record
 *         and the closing advice ("re-run without --force") causes a *second* real
 *         execution rather than a replay.
 */
function assertForceHasPriorAttempt(orderId: string, chain: ChainKind): void {
  const prior = getTransfer(orderId);
  const usable =
    chain === "evm" ? Boolean(prior?.from) : Boolean(prior?.signedTransaction);

  if (usable) return;

  console.error(
    `--force needs a prior attempt for "${orderId}", and there is no usable one.`,
  );
  console.error(
    `It exists to show what happens on a *second* attempt, so run it once without`,
  );
  console.error(`--force first:`);
  console.error(
    `  pnpm example:idempotency${chain === "svm" ? " --chain svm" : ""} --order-id ${orderId}`,
  );
  process.exit(1);
}

runScript(async () => {
  const { getFlag, hasFlag } = parseArgs(process.argv);

  const chain = (getFlag("chain") ?? "evm") as ChainKind;
  const orderId = getFlag("order-id");
  const amountFlag = getFlag("amount");

  if (!SUPPORTED_CHAINS.includes(chain)) {
    console.error(`--chain must be one of: ${SUPPORTED_CHAINS.join(", ")}`);
    showUsage();
  }
  if (!orderId) {
    console.error("Please provide an idempotency key via --order-id");
    showUsage();
  }

  assertKeyNotUsedOnOtherChain(orderId, chain);

  const force = hasFlag("force");
  if (force) assertForceHasPriorAttempt(orderId, chain);

  const options: IdempotencyDemoOptions = {
    orderId,
    force,
    ...(getFlag("address") && { address: getFlag("address") }),
    ...(getFlag("password") && { password: getFlag("password") }),
    ...(amountFlag !== undefined && { amount: Number(amountFlag) }),
  };

  console.info("Idempotent Sponsored Transaction Demo");
  console.info("=".repeat(60));
  console.info(`Chain: ${chain}`);
  console.info(`Order ID: ${orderId}`);

  switch (chain) {
    case "evm":
      await runEvmIdempotencyDemo(options);
      return;
    case "svm":
      await runSvmIdempotencyDemo(options);
      return;
    default:
      // Unreachable while every ChainKind is handled — and a compile error the
      // moment a chain is added to SUPPORTED_CHAINS without a case here.
      assertUnsupportedChain(chain);
  }
});
