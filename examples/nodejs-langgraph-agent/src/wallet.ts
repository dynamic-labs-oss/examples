/**
 * Dynamic server-wallet support for the agent.
 *
 * The agent owns its own MPC wallet, created once and persisted to
 * .wallet-state.json (gitignored). No user JWT or delegation credentials are
 * required. Signing is performed entirely server-side via Dynamic MPC.
 *
 * Security note: .wallet-state.json contains the server key share — treat it
 * like a private key. Never commit it or expose it to untrusted parties.
 */

import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";
import type { ServerKeyShare, WalletMetadata } from "@dynamic-labs-wallet/node";
import { createPublicClient, http } from "viem";
import { mainnet, polygon, base, arbitrum, optimism, bsc } from "viem/chains";
import type { Chain, TransactionSerializable } from "viem";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ServerWallet {
  accountAddress: string;
  walletMetadata: WalletMetadata;
  externalServerKeyShares: ServerKeyShare[];
}

// ─── Chain map ────────────────────────────────────────────────────────────────

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  8453: base,
  42161: arbitrum,
  10: optimism,
  56: bsc,
};

export function getChainById(chainId: number): Chain {
  const chain = CHAIN_MAP[chainId];
  if (!chain) {
    throw new Error(
      `Unsupported chainId ${chainId}. Supported: ${Object.keys(CHAIN_MAP).join(", ")}`
    );
  }
  return chain;
}

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_MAP).map(Number);

// ─── Wallet state persistence ────────────────────────────────────────────────

const WALLET_STATE_PATH = join(process.cwd(), ".wallet-state.json");

function loadWalletState(): ServerWallet | null {
  if (!existsSync(WALLET_STATE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(WALLET_STATE_PATH, "utf8")) as ServerWallet;
  } catch {
    console.warn("[wallet] Failed to parse .wallet-state.json — will recreate");
    return null;
  }
}

function saveWalletState(wallet: ServerWallet): void {
  writeFileSync(WALLET_STATE_PATH, JSON.stringify(wallet, null, 2), { encoding: "utf8", mode: 0o600 });
}

// ─── EVM client singleton ─────────────────────────────────────────────────────

let _evmClient: DynamicEvmWalletClient | null = null;

function getEvmClient(): DynamicEvmWalletClient {
  if (!_evmClient) {
    const environmentId = process.env.DYNAMIC_ENVIRONMENT_ID;
    if (!environmentId) {
      throw new Error("DYNAMIC_ENVIRONMENT_ID is required");
    }
    _evmClient = new DynamicEvmWalletClient({ environmentId });
  }
  return _evmClient;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Loads the persisted server wallet or creates a new one on first run.
 * Authenticates the client with DYNAMIC_API_KEY before any MPC calls.
 */
export async function initServerWallet(): Promise<ServerWallet> {
  const apiKey = process.env.DYNAMIC_API_KEY;
  if (!apiKey) {
    throw new Error("DYNAMIC_API_KEY is required");
  }

  const client = getEvmClient();
  await client.authenticateApiToken(apiKey);

  const existing = loadWalletState();
  if (existing) {
    console.log(`[wallet] Loaded server wallet: ${existing.accountAddress}`);
    return existing;
  }

  console.log("[wallet] Creating new server wallet (first run)…");
  const { walletMetadata, externalServerKeyShares } =
    await client.createWalletAccount({
      thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
    });

  const wallet: ServerWallet = {
    accountAddress: walletMetadata.accountAddress,
    walletMetadata,
    externalServerKeyShares,
  };
  saveWalletState(wallet);
  console.log(`[wallet] Created server wallet: ${wallet.accountAddress}`);
  return wallet;
}

// ─── Sign + broadcast ─────────────────────────────────────────────────────────

/**
 * Signs (via Dynamic server-side MPC) and broadcasts a native-value transfer.
 * Returns the transaction hash.
 */
export async function sendTransactionServer(
  wallet: ServerWallet,
  chainId: number,
  to: `0x${string}`,
  value: bigint
): Promise<string> {
  const chain = getChainById(chainId);
  const publicClient = createPublicClient({ chain, transport: http() });
  const address = wallet.accountAddress as `0x${string}`;

  const nonce = await publicClient.getTransactionCount({ address });
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const baseFee = block.baseFeePerGas ?? BigInt(30_000_000_000);
  const maxPriorityFeePerGas = BigInt(1_500_000_000);
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

  let gas: bigint;
  try {
    const estimated = await publicClient.estimateGas({
      account: address,
      to,
      value,
    });
    gas = (estimated * 12n) / 10n;
  } catch {
    gas = BigInt(21_000);
  }

  const transaction: TransactionSerializable = {
    type: "eip1559",
    chainId,
    to,
    value,
    nonce,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };

  const signedTx = await getEvmClient().signTransaction({
    walletMetadata: wallet.walletMetadata,
    transaction,
    externalServerKeyShares: wallet.externalServerKeyShares,
  });

  return publicClient.sendRawTransaction({
    serializedTransaction: signedTx as `0x${string}`,
  });
}
