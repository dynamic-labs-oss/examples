#!/usr/bin/env tsx

/**
 * Unified Idempotent Gasless Transfer
 *
 * One command, one set of flags, either chain. `--chain evm` and `--chain svm`
 * take identical arguments; the abstraction in `src/lib/transfer/index.ts` handles the
 * fact that the two chains need opposite treatment underneath.
 *
 * ## Usage
 *
 *   # native asset
 *   pnpm example:transfer --chain evm --to 0xRecipient --amount 0.0001 \
 *     --idempotency-key order-1 --address 0xSender
 *
 *   pnpm example:transfer --chain svm --to <base58> --amount 0.001 \
 *     --idempotency-key order-2 --address <base58>
 *
 *   # token (ERC-20 or SPL) — same shape on both chains
 *   pnpm example:transfer --chain evm --to 0xRecipient --amount 5 \
 *     --token 0x678d798938bd326d76e5db814457841d055560d0 --decimals 6 \
 *     --idempotency-key order-3 --address 0xSender
 *
 *   # delegated wallet instead of a server wallet
 *   pnpm example:transfer --chain evm --delegated --to 0xRecipient --amount 0.0001 \
 *     --idempotency-key order-4
 *
 * Re-run with the same --idempotency-key: it will report a no-op rather than
 * transferring twice.
 *
 * ## Notes
 *
 * - `--amount` is a decimal string in whole units ("1.5"), not base units.
 * - `--decimals` is optional. Omit it and the layer reads the authoritative value
 *   from the token contract / mint (cached, since decimals are immutable). Supply
 *   it only as an assertion — a mismatch against the chain refuses the transfer.
 * - SPL transfers need the recipient's associated token account to already exist;
 *   sponsorship covers fees, not account rent.
 */

import { parseArgs, runScript } from "../lib/cli";
import { authenticatedEvmClient, delegatedEvmClient } from "../lib/clients/evm";
import { authenticatedSvmClient, delegatedSvmClient } from "../lib/clients/svm";
import {
  type Asset,
  type ChainKind,
  sendGaslessTransfer,
  SUPPORTED_CHAINS,
  type TransferClients,
  type TransferSigner,
  assertUnsupportedChain,
} from "../lib/transfer";
import { getTransfer } from "../lib/transfer/store";
import { getOrCreateWallet } from "../lib/wallet-helpers";
import { loadEvmDelegatedCredentials } from "../evm/delegated/credentials";
import { loadSvmDelegatedCredentials } from "../svm/delegated/credentials";

/** What each chain needs resolved before a transfer can be built. */
interface ResolvedSigner {
  clients: TransferClients;
  signer: TransferSigner;
  from: string;
}

interface ResolveOptions {
  useDelegated: boolean;
  address?: string;
  password?: string;
}

function describeAsset(asset: Asset): string {
  if (asset.kind === "native") return "native";

  const dp =
    asset.decimals === undefined
      ? "decimals read from chain"
      : `${asset.decimals}dp asserted`;
  return `token ${asset.address} (${dp})`;
}

/** Build an EVM client set and signer. */
async function resolveEvm({
  useDelegated,
  address,
  password,
}: ResolveOptions): Promise<ResolvedSigner> {
  const evmClient = await authenticatedEvmClient();

  if (useDelegated) {
    const credentials = loadEvmDelegatedCredentials();
    return {
      clients: { evmClient, evmDelegatedClient: delegatedEvmClient() },
      signer: { kind: "delegated", credentials },
      from: credentials.address,
    };
  }

  const wallet = await getOrCreateWallet(evmClient, address, password);
  return {
    clients: { evmClient },
    signer: {
      kind: "server",
      walletMetadata: wallet.walletMetadata,
      externalServerKeyShares: wallet.externalServerKeyShares,
      ...(password && { password }),
    },
    from: wallet.address,
  };
}

/** Build an SVM client set and signer. */
async function resolveSvm({
  useDelegated,
  address,
  password,
}: ResolveOptions): Promise<ResolvedSigner> {
  const svmClient = await authenticatedSvmClient();

  if (useDelegated) {
    const credentials = loadSvmDelegatedCredentials();
    return {
      clients: { svmClient, svmDelegatedClient: delegatedSvmClient() },
      signer: { kind: "delegated", credentials },
      from: credentials.address,
    };
  }

  const wallet = await getOrCreateWallet(svmClient, address, password);
  return {
    clients: { svmClient },
    signer: {
      kind: "server",
      walletMetadata: wallet.walletMetadata,
      externalServerKeyShares: wallet.externalServerKeyShares,
      ...(password && { password }),
    },
    from: wallet.address,
  };
}

/**
 * Dispatch on chain.
 *
 * One `case` per chain, with an explicit unsupported default — adding a chain
 * means adding a resolver and a case here. The default also throws for input that
 * slipped past validation, so an unknown chain never silently picks a branch.
 */
async function resolveSigner(
  chain: ChainKind,
  options: ResolveOptions,
): Promise<ResolvedSigner> {
  switch (chain) {
    case "evm":
      return resolveEvm(options);
    case "svm":
      return resolveSvm(options);
    default:
      // Consumes the narrowed type, so adding a chain to SUPPORTED_CHAINS fails
      // the build here. A plain `throw` would compile and only fail at runtime.
      return assertUnsupportedChain(chain);
  }
}

function showUsage(): never {
  console.error("Usage:");
  console.error(
    "  pnpm example:transfer --chain <evm|svm> --to <address> --amount <decimal> \\",
  );
  console.error(
    "    --idempotency-key <key> [--address <sender>] [--delegated]",
  );
  console.error("    [--token <address>] [--decimals <n>] [--password <pw>]");
  console.error("");
  console.error("Examples:");
  console.error(
    "  pnpm example:transfer --chain evm --to 0xabc... --amount 0.0001 --idempotency-key order-1",
  );
  console.error(
    "  pnpm example:transfer --chain svm --to 8FEy... --amount 0.001 --idempotency-key order-2",
  );
  process.exit(1);
}

runScript(async () => {
  const { getFlag, hasFlag } = parseArgs(process.argv);

  const chain = getFlag("chain") as ChainKind | undefined;
  const to = getFlag("to");
  const amount = getFlag("amount");
  const idempotencyKey = getFlag("idempotency-key");
  const address = getFlag("address");
  const password = getFlag("password");
  const useDelegated = hasFlag("delegated");
  const token = getFlag("token");
  const decimals = getFlag("decimals");

  if (!chain || !SUPPORTED_CHAINS.includes(chain)) {
    console.error(`--chain must be one of: ${SUPPORTED_CHAINS.join(", ")}`);
    showUsage();
  }
  if (!to || !amount || !idempotencyKey) {
    console.error("--to, --amount and --idempotency-key are all required");
    showUsage();
  }

  // --decimals is optional: the layer reads the authoritative value from the
  // token contract / mint. Supplying it makes the layer verify rather than trust.
  if (decimals !== undefined && !Number.isInteger(Number(decimals))) {
    console.error(`--decimals must be an integer (got "${decimals}")`);
    process.exit(1);
  }

  const asset: Asset = token
    ? {
        kind: "token",
        address: token,
        ...(decimals !== undefined && { decimals: Number(decimals) }),
      }
    : { kind: "native" };

  // Report a settled key before resolving a signer.
  //
  // `sendGaslessTransfer` short-circuits on a settled record anyway, but
  // `resolveSigner` runs first and *creates a wallet* when --address is omitted —
  // so a no-op retry would mint a throwaway wallet via the API and print it as
  // `From:`. The idempotency examples avoid the same trap; see
  // src/examples/idempotency/evm.ts.
  const settled = getTransfer(idempotencyKey);
  if (settled?.status === "success" && settled.transactionId) {
    console.info("Unified Gasless Transfer");
    console.info("=".repeat(60));
    console.info(`Key:        ${idempotencyKey}`);
    console.info(`No-op — this key already executed.`);
    console.info(`Chain:      ${settled.chain}`);
    console.info(`From:       ${settled.from}`);
    console.info(`Transaction: ${settled.transactionId}`);
    console.info("=".repeat(60));
    return;
  }

  // Build only the clients this chain needs, via a per-chain resolver.
  const { clients, signer, from } = await resolveSigner(chain, {
    useDelegated,
    address,
    password,
  });

  console.info("Unified Gasless Transfer");
  console.info("=".repeat(60));
  console.info(`Chain:      ${chain}`);
  console.info(`Signer:     ${signer.kind}`);
  console.info(`From:       ${from}`);
  console.info(`To:         ${to}`);
  console.info(`Asset:      ${describeAsset(asset)}`);
  console.info(`Amount:     ${amount}`);
  console.info(`Key:        ${idempotencyKey}`);
  console.info("=".repeat(60));
  console.info("");

  const start = Date.now();
  const result = await sendGaslessTransfer({
    idempotencyKey,
    chain,
    signer,
    clients,
    from,
    to,
    amount,
    asset,
  });
  const duration = ((Date.now() - start) / 1000).toFixed(2);

  console.info("");
  console.info("=".repeat(60));
  console.info(
    result.executed
      ? `Transferred in ${duration}s`
      : `No-op — this key already executed (checked in ${duration}s)`,
  );
  console.info(`Transaction: ${result.transactionId}`);
  console.info(`Explorer:    ${result.explorerUrl}`);
  console.info(`Base units:  ${result.amountBaseUnits}`);
  console.info("");
  console.info(
    `Re-run with --idempotency-key ${idempotencyKey} — it will not transfer again.`,
  );
  console.info("=".repeat(60));
});
