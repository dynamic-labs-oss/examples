"use client";

import type { Wallet } from "@dynamic-labs/client";
import { dynamicClient } from "@/lib/dynamic";
import { CHAINS, type MgChain } from "./chains";

/**
 * Send USDC to the given address on the specified chain.
 * Dispatches to EVM or Solana signing based on chain type.
 *
 * @returns Transaction hash (EVM) or signature (Solana)
 */
export async function sendUsdc({
  to,
  amount,
  chain,
  wallets,
}: {
  to: string;
  amount: string;
  chain: MgChain;
  wallets: Wallet[];
}): Promise<string> {
  const config = CHAINS[chain];

  // ── EVM (Base Sepolia or Eth Sepolia) ──────────────────────────────────────
  if (config.type === "evm") {
    const evmWallet = wallets.find((w) => w.chain === "EVM");
    if (!evmWallet) throw new Error("No EVM wallet found. Connect an EVM embedded wallet.");

    const { hash } = await dynamicClient.wallets.sendBalance({
      wallet: evmWallet,
      amount,
      toAddress: to,
      token: {
        address: config.usdcAddress,
        decimals: 6,
      },
    });
    return hash;
  }

  // ── Solana Devnet ──────────────────────────────────────────────────────────
  const solanaWallet = wallets.find((w) => w.chain === "SOL");
  if (!solanaWallet) throw new Error("No Solana wallet found. Connect a Solana embedded wallet.");

  const { hash } = await dynamicClient.wallets.sendBalance({
    wallet: solanaWallet,
    amount,
    toAddress: to,
    token: {
      // TODO: Verify that sendBalance for Solana accepts the SPL token mint address
      address: config.usdcMint,
      decimals: 6,
    },
  });
  return hash;
}
