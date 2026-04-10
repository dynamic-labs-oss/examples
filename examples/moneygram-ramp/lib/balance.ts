"use client";

import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { CHAINS, type MgChain } from "./chains";

const erc20BalanceAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

/**
 * Fetch on-chain USDC balance for the given chain and address.
 * Returns 0 if the account doesn't exist or on any error.
 */
export async function fetchUsdcBalance(
  chain: MgChain,
  address: string,
): Promise<number> {
  if (!address) return 0;

  const config = CHAINS[chain];

  try {
    if (config.type === "evm") {
      const client = createPublicClient({
        chain: config.viemChain,
        transport: http(),
      });
      const raw = await client.readContract({
        address: config.usdcAddress,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      return parseFloat(formatUnits(raw, 6));
    }

    if (config.type === "solana") {
      const connection = new Connection(config.rpcUrl, "confirmed");
      const ata = await getAssociatedTokenAddress(
        new PublicKey(config.usdcMint),
        new PublicKey(address),
      );
      const info = await connection.getTokenAccountBalance(ata);
      return parseFloat(info.value.uiAmountString ?? "0");
    }
  } catch {
    // Token account may not exist yet (zero balance)
  }

  return 0;
}
