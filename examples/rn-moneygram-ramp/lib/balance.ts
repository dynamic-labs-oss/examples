import { dynamicClient } from "./dynamic";

/**
 * Fetch the USDC balance for a Solana address.
 *
 * `getConnection()` reflects whichever network Dynamic is currently on
 * (mainnet / devnet), so the balance always matches the active network.
 */
export async function fetchUsdcBalance(
  address: string,
  usdcMint?: string,
): Promise<number> {
  if (!address) return 0;
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const { getAssociatedTokenAddress, getAccount } = await import(
      "@solana/spl-token"
    );
    const mint = usdcMint ?? process.env.EXPO_PUBLIC_SOLANA_USDC_MINT;
    if (!mint) throw new Error("EXPO_PUBLIC_SOLANA_USDC_MINT is not set");
    const connection = dynamicClient.solana.getConnection();
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
