import { createPublicClient, erc20Abi, http } from "viem";
import { base, mainnet } from "viem/chains";
import type { Chain } from "./chains";

const publicClients = {
  base: createPublicClient({ chain: base, transport: http() }),
  ethereum: createPublicClient({ chain: mainnet, transport: http() }),
};

const EVM_USDC: Record<string, `0x${string}`> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

export async function fetchEvmUsdcBalance(
  chain: "base" | "ethereum",
  address: string
): Promise<number> {
  try {
    const client = publicClients[chain];
    const raw = await client.readContract({
      address: EVM_USDC[chain],
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return Number(raw) / 1e6;
  } catch {
    return 0;
  }
}

export async function fetchSolanaUsdcBalance(address: string): Promise<number> {
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const { getAssociatedTokenAddress, getAccount } = await import(
      "@solana/spl-token"
    );
    const rpc =
      process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
      "https://api.devnet.solana.com";
    const mint = process.env.EXPO_PUBLIC_SOLANA_USDC_MINT;
    if (!mint) throw new Error("EXPO_PUBLIC_SOLANA_USDC_MINT is not set");
    const connection = new Connection(rpc, "confirmed");
    const ata = await getAssociatedTokenAddress(
      new PublicKey(mint),
      new PublicKey(address)
    );
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 1e6;
  } catch {
    return 0;
  }
}

export async function fetchUsdcBalance(
  chain: Chain,
  address: string
): Promise<number> {
  if (!address) return 0;
  if (chain === "solana") return fetchSolanaUsdcBalance(address);
  return fetchEvmUsdcBalance(chain as "base" | "ethereum", address);
}
