"use client";

import {
  executeSwapTransaction,
  getActiveNetworkData,
  getSwapQuote,
  getSwapStatus,
} from "@dynamic-labs-sdk/client";
import type { SolanaWalletAccount } from "@dynamic-labs-sdk/solana";

const SOL_TOKEN = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const STATUS_POLL_INTERVAL = 3000;

// Swaps SOL → USDC via Dynamic's swap SDK (mirrors the Dynamic demo app pattern).
// LI.FI handles USDC ATA creation inside the swap transaction — do NOT pre-create it.
export async function fundWalletWithSol(
  amountUsd: number,
  walletAddress: string,
  walletAccount: SolanaWalletAccount,
): Promise<void> {
  const { networkData } = await getActiveNetworkData({ walletAccount });
  if (!networkData)
    throw new Error("Could not determine active Solana network");
  const networkId = networkData.networkId;

  const usdcAmount = Math.ceil(amountUsd * 1_000_000_000).toString();

  // Step 1 — get quote (ExactOut: receive exactly the USDC amount needed)
  const quote = await getSwapQuote({
    from: {
      address: walletAddress,
      chain: "SOL",
      networkId,
      tokenAddress: SOL_TOKEN,
    },
    to: {
      address: walletAddress,
      chain: "SOL",
      networkId,
      tokenAddress: USDC_MINT,
      amount: usdcAmount,
    },
    slippage: 0.1,
    order: "FASTEST",
  });

  if (!quote.signingPayload)
    throw new Error("No signing payload in swap quote");

  // Step 2 — execute (Dynamic handles MPC signing + broadcast)
  const { transactionHash } = await executeSwapTransaction({
    walletAccount,
    signingPayload: quote.signingPayload,
  });

  // Step 3 — poll until DONE or FAILED (matches demo's checkStatusAtom pattern)
  while (true) {
    const { status, substatus } = await getSwapStatus({
      txHash: transactionHash,
      from: { chain: "SOL", networkId },
    });

    if (status === "DONE") return;
    if (status === "FAILED")
      throw new Error(`Swap failed: ${substatus ?? "unknown"}`);

    await new Promise((r) => setTimeout(r, STATUS_POLL_INTERVAL));
  }
}
