import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokenAmount(amount: string | bigint, decimals = 6): string {
  const n = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const frac = n % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

export function formatPeriod(periodSeconds: number): string {
  if (periodSeconds === 60) return "per minute";
  if (periodSeconds === 3600) return "per hour";
  if (periodSeconds === 86400) return "per day";
  if (periodSeconds === 604800) return "per week";
  if (periodSeconds === 2592000) return "per month";
  if (periodSeconds % 3600 === 0) return `every ${periodSeconds / 3600} hours`;
  return `every ${periodSeconds} seconds`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}
