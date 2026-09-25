#!/usr/bin/env tsx

/**
 * Smoke Test Runner
 *
 * Runs the example commands in one pass and reports pass/fail per step.
 * Not a unit test suite — it exercises the real CLI entrypoints end to end.
 *
 * ## Tiers
 *
 * Steps are grouped by what they cost, and the expensive tiers are opt-in:
 *
 *   offline  (default)  Type-check + argument validation. No network, no credentials.
 *   signing  --signing  Off-chain signing. Needs DYNAMIC_* credentials. Creates
 *                       wallets via the API but sends nothing on-chain.
 *   onchain  --onchain  Sponsored transactions. Needs EVM Gas Sponsorship enabled
 *                       and SPENDS RELAYER BUDGET.
 *
 * ## Usage
 *
 *   pnpm smoke                      # offline only (safe, no credentials)
 *   pnpm smoke --signing            # + off-chain signing
 *   pnpm smoke --onchain            # + sponsored transactions (costs budget)
 *   pnpm smoke --all                # everything
 *   pnpm smoke --all --delegated    # also the delegated wallet steps
 *
 * Both chains run by default. Narrow with --evm or --svm:
 *
 *   pnpm smoke --svm --signing      # Solana signing steps only
 *
 * The delegated steps need that chain's src/{evm,svm}/delegated/wallet.json, so
 * they are opt-in via --delegated to keep the default run green on a fresh clone.
 *
 * Deliberately not covered:
 *   - `standard` (non-sponsored) sends, which need a funded wallet
 *   - the omnibus sweep, which is far heavier than the other commands
 *   - a *successful* svm:transfer-token, which needs the wallet's associated token
 *     account to already exist (a 0-amount transfer is fine, but the account costs
 *     rent, which sponsorship does not cover); the missing-account path is covered
 *     instead
 *   - example:transfer on chain, which rejects a zero amount and so needs a wallet
 *     already holding the asset; only its argument handling is covered
 * Run those directly: `pnpm evm:send-txn standard`, `pnpm example:omnibus 2`.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

type Tier = "offline" | "signing" | "onchain";

type Chain = "evm" | "svm";

interface Step {
  name: string;
  tier: Tier;
  command: string;
  args: string[];
  /** Which chain this exercises. Omitted for chain-agnostic steps. */
  chain?: Chain;
  /** Expected exit code. Defaults to 0. */
  exitCode?: number;
  /** Substring that must appear in output. */
  expect?: string;
  /** Only run when --delegated is passed. Needs that chain's wallet.json. */
  delegated?: boolean;
}

const TIER_ORDER: Tier[] = ["offline", "signing", "onchain"];

/** Per-chain delegated credential files, checked before running those steps. */
const DELEGATED_WALLET_FILES: Record<Chain, string> = {
  evm: "src/evm/delegated/wallet.json",
  svm: "src/svm/delegated/wallet.json",
};

/** This file lives in src/, so the package root is one level up. */
const projectRoot = join(__dirname, "..");

/** Entrypoints, addressed directly so the runner doesn't nest package managers. */
const tsx = (script: string, ...args: string[]) => ({
  command: "npx",
  args: ["tsx", script, ...args],
});

/**
 * Idempotency keys for the on-chain retry assertions, unique per smoke run.
 *
 * Two steps share each key: the first must execute, the second must no-op. A fixed
 * key would only execute on the very first run ever, and would eventually break
 * once the recorded signature aged out of the RPC's queryable history.
 *
 * One key per chain, because the store keys on the order id alone and rejects a key
 * that was already used on the other chain.
 *
 * Both pairs assert on the "relayed / executed this run" line rather than the
 * balance delta. That line is driven by the persisted record, so it is
 * deterministic; the delta depends on the RPC reflecting the mint by the time the
 * balance is read, which is not guaranteed and does intermittently report 0.
 */
const SMOKE_IDEMPOTENCY_KEY_SVM = `smoke-svm-${Date.now()}`;
const SMOKE_IDEMPOTENCY_KEY_EVM = `smoke-evm-${Date.now()}`;

const STEPS: Step[] = [
  // ---- offline: no network, no credentials -------------------------------
  {
    name: "type-check (tsc --noEmit)",
    tier: "offline",
    command: "npx",
    args: ["tsc", "--noEmit"],
  },

  // EVM argument handling
  {
    name: "evm:wallet --list",
    tier: "offline",
    chain: "evm",
    ...tsx("src/evm/wallet.ts", "--list"),
  },
  {
    name: "evm:wallet rejects --backup without --password",
    tier: "offline",
    chain: "evm",
    ...tsx("src/evm/wallet.ts", "--create", "--backup"),
    exitCode: 1,
    expect: "--backup requires --password",
  },
  {
    name: "evm:wallet shows usage with no action",
    tier: "offline",
    chain: "evm",
    ...tsx("src/evm/wallet.ts"),
    exitCode: 1,
    expect: "Please specify an action",
  },
  {
    name: "evm:send-txn rejects unknown mode",
    tier: "offline",
    chain: "evm",
    ...tsx("src/evm/send-transaction.ts", "bogus"),
    exitCode: 1,
    expect: "Valid modes: standard, gasless",
  },
  {
    name: "evm:transfer-token rejects a malformed --amount",
    tier: "offline",
    chain: "evm",
    ...tsx("src/evm/transfer-token.ts", "--amount", "abc"),
    exitCode: 1,
    expect: "not a valid amount",
  },
  {
    name: "evm:sign-msg requires a message",
    tier: "offline",
    chain: "evm",
    ...tsx("src/evm/sign-message.ts"),
    exitCode: 1,
    expect: "Please provide a message",
  },
  {
    name: "evm:delegated:sign-msg requires a message",
    tier: "offline",
    chain: "evm",
    ...tsx("src/evm/delegated/sign-message.ts"),
    exitCode: 1,
    expect: "Please provide a message",
    delegated: true,
  },

  // SVM argument handling
  {
    name: "svm:wallet --list",
    tier: "offline",
    chain: "svm",
    ...tsx("src/svm/wallet.ts", "--list"),
  },
  {
    name: "svm:wallet rejects --backup without --password",
    tier: "offline",
    chain: "svm",
    ...tsx("src/svm/wallet.ts", "--create", "--backup"),
    exitCode: 1,
    expect: "--backup requires --password",
  },
  {
    name: "svm:wallet shows usage with no action",
    tier: "offline",
    chain: "svm",
    ...tsx("src/svm/wallet.ts"),
    exitCode: 1,
    expect: "Please specify an action",
  },
  {
    name: "svm:send-txn rejects unknown mode",
    tier: "offline",
    chain: "svm",
    ...tsx("src/svm/send-transaction.ts", "bogus"),
    exitCode: 1,
    expect: "Valid modes: standard, gasless",
  },
  {
    name: "svm:transfer-token rejects a malformed --amount",
    tier: "offline",
    chain: "svm",
    ...tsx("src/svm/transfer-token.ts", "--amount", "abc"),
    exitCode: 1,
    expect: "not a valid amount",
  },
  {
    name: "svm:sign-msg requires a message",
    tier: "offline",
    chain: "svm",
    ...tsx("src/svm/sign-message.ts"),
    exitCode: 1,
    expect: "Please provide a message",
  },
  {
    name: "svm:delegated:sign-msg requires a message",
    tier: "offline",
    chain: "svm",
    ...tsx("src/svm/delegated/sign-message.ts"),
    exitCode: 1,
    expect: "Please provide a message",
    delegated: true,
  },
  {
    name: "example:idempotency requires --order-id",
    tier: "offline",
    chain: "evm",
    ...tsx("src/examples/idempotency/index.ts"),
    exitCode: 1,
    expect: "--order-id",
  },
  {
    name: "example:idempotency rejects an unsupported chain",
    tier: "offline",
    ...tsx("src/examples/idempotency/index.ts", "--chain", "btc", "--order-id", "k"),
    exitCode: 1,
    expect: "--chain must be one of",
  },
  {
    name: "example:idempotency rejects --amount on svm",
    tier: "offline",
    chain: "svm",
    ...tsx(
      "src/examples/idempotency/index.ts",
      "--chain",
      "svm",
      "--order-id",
      "k",
      "--amount",
      "5",
    ),
    exitCode: 1,
    expect: "--amount is EVM-only",
  },
  {
    name: "example:transfer requires core flags",
    tier: "offline",
    ...tsx("src/examples/unified-transfer.ts"),
    exitCode: 1,
    expect: "--chain must be one of",
  },
  {
    name: "example:transfer rejects non-integer --decimals",
    tier: "offline",
    ...tsx(
      "src/examples/unified-transfer.ts",
      "--chain",
      "evm",
      "--to",
      "0xabc",
      "--amount",
      "1",
      "--idempotency-key",
      "k",
      "--token",
      "0xdef",
      "--decimals",
      "six",
    ),
    exitCode: 1,
    expect: "--decimals must be an integer",
  },
  {
    name: "example:transfer rejects an unsupported chain",
    tier: "offline",
    ...tsx(
      "src/examples/unified-transfer.ts",
      "--chain",
      "btc",
      "--to",
      "x",
      "--amount",
      "1",
      "--idempotency-key",
      "k",
    ),
    exitCode: 1,
    expect: "--chain must be one of",
  },

  // ---- signing: credentials required, nothing on-chain -------------------
  {
    name: "evm:wallet --create (ephemeral)",
    tier: "signing",
    chain: "evm",
    ...tsx("src/evm/wallet.ts", "--create"),
    expect: "Server wallet created",
  },
  {
    name: "evm:sign-msg (ephemeral wallet)",
    tier: "signing",
    chain: "evm",
    ...tsx("src/evm/sign-message.ts", "smoke test message"),
    expect: "Message signed",
  },
  {
    name: "evm:sign-typed-data (ephemeral wallet)",
    tier: "signing",
    chain: "evm",
    ...tsx("src/evm/sign-typed-data.ts"),
    expect: "Typed data signed",
  },
  {
    name: "evm:transfer-token rejects an over-precise --amount",
    tier: "signing",
    chain: "evm",
    // 6-decimal token, so this is a tenth of a base unit. viem's parseUnits would
    // round it up to 2 and move more than asked; the guard has to reject it. Needs
    // the signing tier because decimals are read from the contract first.
    ...tsx("src/evm/transfer-token.ts", "--sponsored", "--amount", "1.999999999"),
    exitCode: 1,
    expect: "more precision",
  },
  {
    name: "evm:delegated:sign-msg",
    tier: "signing",
    chain: "evm",
    ...tsx("src/evm/delegated/sign-message.ts", "smoke test message"),
    expect: "Message signed",
    delegated: true,
  },
  {
    name: "svm:wallet --create (ephemeral)",
    tier: "signing",
    chain: "svm",
    ...tsx("src/svm/wallet.ts", "--create"),
    expect: "Solana server wallet created",
  },
  {
    name: "svm:sign-msg (ephemeral wallet)",
    tier: "signing",
    chain: "svm",
    ...tsx("src/svm/sign-message.ts", "smoke test message"),
    expect: "Message signed",
  },
  {
    name: "svm:transfer-token reports a missing token account",
    tier: "signing",
    chain: "svm",
    // A fresh wallet has no associated token account for the mint, and this script
    // will not create one (rent isn't sponsored). Pins the actionable error, and
    // exercises decimals-from-mint plus ATA derivation against real chain state.
    ...tsx("src/svm/transfer-token.ts", "--sponsored"),
    exitCode: 1,
    expect: "no token account",
  },
  {
    name: "svm:delegated:sign-msg",
    tier: "signing",
    chain: "svm",
    ...tsx("src/svm/delegated/sign-message.ts", "smoke test message"),
    expect: "Message signed",
    delegated: true,
  },

  // ---- onchain: sponsored transactions, spends sponsorship budget ---------
  {
    name: "evm:send-txn gasless (Dynamic sponsorship)",
    tier: "onchain",
    chain: "evm",
    ...tsx("src/evm/send-transaction.ts", "gasless"),
    expect: "Transaction sent",
  },
  {
    name: "evm:transfer-token --sponsored (ERC-20)",
    tier: "onchain",
    chain: "evm",
    ...tsx("src/evm/transfer-token.ts", "--sponsored"),
    expect: "Transfer sent",
  },
  {
    name: "evm:delegated:send-txn (gasless)",
    tier: "onchain",
    chain: "evm",
    ...tsx("src/evm/delegated/send-transaction.ts"),
    expect: "Transaction sent",
    delegated: true,
  },
  {
    name: "svm:send-txn gasless (Dynamic sponsorship)",
    tier: "onchain",
    chain: "svm",
    ...tsx("src/svm/send-transaction.ts", "gasless"),
    expect: "Transaction sent",
  },
  {
    name: "svm:delegated:send-txn (gasless)",
    tier: "onchain",
    chain: "svm",
    ...tsx("src/svm/delegated/send-transaction.ts"),
    expect: "Transaction sent",
    delegated: true,
  },
  // The retry assertions, in two halves each: execute, then prove the retry
  // doesn't. Ordering matters — each pair must stay adjacent and in this order.
  //
  // Ephemeral wallets are fine here. The retry short-circuits before resolving a
  // wallet and reads the address back out of the store, so it reports the first
  // run's wallet rather than creating an unrelated one.
  {
    name: "example:idempotency --chain evm (first run executes)",
    tier: "onchain",
    chain: "evm",
    ...tsx(
      "src/examples/idempotency/index.ts",
      "--order-id",
      SMOKE_IDEMPOTENCY_KEY_EVM,
    ),
    expect: "Relayed this run: yes",
  },
  {
    name: "example:idempotency --chain evm (retry is a no-op)",
    tier: "onchain",
    chain: "evm",
    ...tsx(
      "src/examples/idempotency/index.ts",
      "--order-id",
      SMOKE_IDEMPOTENCY_KEY_EVM,
    ),
    expect: "Relayed this run: no",
  },
  {
    name: "example:idempotency --chain svm (first run executes)",
    tier: "onchain",
    chain: "svm",
    ...tsx(
      "src/examples/idempotency/index.ts",
      "--chain",
      "svm",
      "--order-id",
      SMOKE_IDEMPOTENCY_KEY_SVM,
    ),
    expect: "Executed this run: yes",
  },
  {
    name: "example:idempotency --chain svm (retry is a no-op)",
    tier: "onchain",
    chain: "svm",
    ...tsx(
      "src/examples/idempotency/index.ts",
      "--chain",
      "svm",
      "--order-id",
      SMOKE_IDEMPOTENCY_KEY_SVM,
    ),
    expect: "Executed this run: no",
  },
];

// The omnibus sweep is deliberately excluded from every tier: it creates N+1
// wallets and relays 2N sponsored transactions, which is too heavy for a smoke
// run. Exercise it directly with `pnpm example:omnibus 2`.

interface Result {
  step: Step;
  passed: boolean;
  reason?: string;
  durationMs: number;
}

/**
 * Pull the useful lines out of a failed step's output.
 *
 * Tailing the last N lines is tempting but wrong: Node prints the message first
 * and the stack after it, so a tail shows nothing but `at ...` frames and hides
 * the one line that explains the failure. Drop stack frames, keep the rest.
 */
function summarizeFailure(output: string): string {
  const lines = output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .filter((line) => !/^\s*at\s/.test(line));

  const meaningful = lines.length > 0 ? lines : output.trim().split("\n");

  // Errors surface at the end, but keep a little preceding context.
  return meaningful.slice(-6).join("\n      ") || "(no output)";
}

function runStep(step: Step): Result {
  const start = Date.now();
  const { command, args } = step;

  const proc = spawnSync(command, args, {
    encoding: "utf-8",
    // Ignore stdin so nothing can block waiting on input.
    stdio: ["ignore", "pipe", "pipe"],
  });

  const durationMs = Date.now() - start;
  const output = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
  const expectedExit = step.exitCode ?? 0;

  if (proc.error) {
    return {
      step,
      passed: false,
      reason: `failed to spawn: ${proc.error.message}`,
      durationMs,
    };
  }

  if (proc.status !== expectedExit) {
    return {
      step,
      passed: false,
      reason: `exit ${proc.status} (expected ${expectedExit})\n      ${summarizeFailure(output)}`,
      durationMs,
    };
  }

  if (step.expect && !output.includes(step.expect)) {
    return {
      step,
      passed: false,
      reason: `output did not contain "${step.expect}"`,
      durationMs,
    };
  }

  return { step, passed: true, durationMs };
}

function main() {
  const argv = process.argv.slice(2);
  const has = (flag: string) => argv.includes(`--${flag}`);
  const all = has("all");

  const tiers = new Set<Tier>(["offline"]);
  if (all || has("signing")) tiers.add("signing");
  if (all || has("onchain")) tiers.add("onchain");

  // Chains default to both; --evm / --svm narrow to one.
  const chains = new Set<Chain>();
  if (has("evm")) chains.add("evm");
  if (has("svm")) chains.add("svm");
  if (chains.size === 0) {
    chains.add("evm");
    chains.add("svm");
  }

  const includeDelegated = has("delegated");

  // Each chain keeps its own delegated credentials, so check only the ones in play.
  if (includeDelegated) {
    const missing = [...chains].filter(
      (chain) => !existsSync(join(projectRoot, DELEGATED_WALLET_FILES[chain])),
    );

    if (missing.length > 0) {
      console.error("--delegated was passed but these files do not exist:");
      for (const chain of missing) {
        console.error(`  ${DELEGATED_WALLET_FILES[chain]}`);
      }

      console.error("\nEither create them:");
      for (const chain of missing) {
        const dir = DELEGATED_WALLET_FILES[chain].replace("/wallet.json", "");
        console.error(`  cp ${dir}/wallet.json.example ${dir}/wallet.json`);
        console.error(`  # then fill in the credentials — see ${dir}/README.md`);
      }

      // Suggest only routes that actually work from here. Naming the chains
      // already in play would be useless advice when the run is narrowed to a
      // chain whose file is the missing one.
      const usable = (["evm", "svm"] as Chain[]).filter(
        (chain) => chains.has(chain) && !missing.includes(chain),
      );

      console.error("\n...or run without them:");
      if (usable.length > 0) {
        console.error(
          `  pnpm smoke --delegated ${usable.map((c) => `--${c}`).join(" ")}`,
        );
      }
      console.error(`  pnpm smoke        # drop --delegated entirely`);

      process.exit(1);
    }
  }

  const selected = STEPS.filter(
    (step) =>
      tiers.has(step.tier) &&
      (includeDelegated || !step.delegated) &&
      (!step.chain || chains.has(step.chain)),
  );

  const tierList = TIER_ORDER.filter((t) => tiers.has(t)).join(", ");
  const chainList = (["evm", "svm"] as Chain[])
    .filter((c) => chains.has(c))
    .join(", ");
  console.info("Dynamic Server Wallets - Smoke Tests");
  console.info("=".repeat(60));
  console.info(`Tiers:     ${tierList}`);
  console.info(`Chains:    ${chainList}`);
  console.info(`Delegated: ${includeDelegated ? "included" : "skipped"}`);
  console.info(`Steps:     ${selected.length}`);
  if (tiers.has("onchain")) {
    console.info("");
    console.info(
      "NOTE: the onchain tier relays real sponsored transactions and",
    );
    console.info("      consumes gas sponsorship budget.");
  }
  console.info("=".repeat(60));
  console.info("");

  const results: Result[] = [];

  for (const [index, step] of selected.entries()) {
    const result = runStep(step);
    results.push(result);

    // Print the whole line only once the step is done, rather than writing the
    // label first and the verdict after. Child tooling (npx, for one) writes
    // progress spinners straight to the TTY, which would clobber a half-written
    // line — so the label could come out truncated.
    const label = `[${index + 1}/${selected.length}] ${step.name}`;
    const seconds = (result.durationMs / 1000).toFixed(1);
    const verdict = result.passed ? "PASS" : "FAIL";

    console.info(`${label} ... ${verdict} (${seconds}s)`);
    if (!result.passed) {
      console.info(`      ${result.reason}`);
    }
  }

  const failed = results.filter((r) => !r.passed);

  console.info("");
  console.info("=".repeat(60));
  console.info(
    `${results.length - failed.length}/${results.length} passed, ${failed.length} failed`,
  );

  if (failed.length > 0) {
    console.info("");
    console.info("Failed steps:");
    for (const { step } of failed) {
      console.info(`  - [${step.tier}] ${step.name}`);
    }
    console.info("");
    console.info(
      "If signing/onchain steps failed, check DYNAMIC_API_TOKEN and",
    );
    console.info(
      "DYNAMIC_ENVIRONMENT_ID in .env, and that EVM Gas Sponsorship is",
    );
    console.info("enabled for your environment.");
  }
  console.info("=".repeat(60));

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
