import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mainnet USDC, USDT, and SOL — addresses sourced from official Solana token list
const TOKEN_INFO: Record<string, { symbol: string; name: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin", decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", name: "Tether USD", decimals: 6 },
  So11111111111111111111111111111111111111112: { symbol: "SOL", name: "Solana", decimals: 9 },
};

// Extend TOKEN_INFO with the configured devnet/custom token mint at module init
const configuredMint = process.env.NEXT_PUBLIC_TOKEN_MINT;
if (configuredMint && !(configuredMint in TOKEN_INFO)) {
  TOKEN_INFO[configuredMint] = { symbol: "USDC", name: "USD Coin (devnet)", decimals: 6 };
}

export function getTokenInfo(mint: string): { symbol: string; name: string; decimals: number } {
  return TOKEN_INFO[mint] ?? { symbol: mint.slice(0, 4) + "...", name: "Unknown Token", decimals: 6 };
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${fracStr}`;
}

export function formatPeriod(periodHours: bigint): string {
  const h = Number(periodHours);
  if (h === 1) return "per hour";
  if (h === 24) return "per day";
  if (h === 168) return "per week";
  if (h === 720) return "per month";
  if (h === 8760) return "per year";
  return `every ${h} hours`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function isPlanActive(status: number): boolean {
  return status === 0; // PlanStatus.Active
}
