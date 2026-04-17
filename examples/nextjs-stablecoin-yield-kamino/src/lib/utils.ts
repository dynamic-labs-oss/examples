import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Well-known Solana token mints
const TOKEN_INFO: Record<string, { symbol: string; name: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin", decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", name: "Tether USD", decimals: 6 },
  "So11111111111111111111111111111111111111112": { symbol: "SOL", name: "Solana", decimals: 9 },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { symbol: "mSOL", name: "Marinade SOL", decimals: 9 },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": { symbol: "stSOL", name: "Lido Staked SOL", decimals: 9 },
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: { symbol: "bSOL", name: "BlazeStake SOL", decimals: 9 },
  USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA: { symbol: "USDS", name: "USDS", decimals: 6 },
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": { symbol: "PYUSD", name: "PayPal USD", decimals: 6 },
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E": { symbol: "BTC", name: "Bitcoin (Wormhole)", decimals: 6 },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { symbol: "ETH", name: "Ether (Wormhole)", decimals: 8 },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: "JUP", name: "Jupiter", decimals: 6 },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: "BONK", name: "Bonk", decimals: 5 },
};

export function getTokenInfo(mint: string): { symbol: string; name: string; decimals: number } {
  return TOKEN_INFO[mint] ?? { symbol: mint.slice(0, 4) + "...", name: "Unknown Token", decimals: 6 };
}

export function formatAPY(apy: number): string {
  if (apy === 0 || isNaN(apy)) return "—";
  return `${(apy * 100).toFixed(2)}%`;
}

export function formatTVL(tvl: number): string {
  if (!tvl || isNaN(tvl)) return "—";
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(2)}K`;
  return `$${tvl.toFixed(2)}`;
}

export function formatTokenAmount(amount: number, decimals: number = 6): string {
  if (!amount || isNaN(amount)) return "0.00";
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals > 6 ? 6 : decimals,
  });
}

export function formatUSD(value: number): string {
  if (!value || isNaN(value)) return "$0.00";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function extractNumericValue(
  value: string | { value: string } | number | undefined
): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (typeof value === "object" && "value" in value)
    return parseFloat(value.value) || 0;
  return 0;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
