/**
 * Ramp constants
 */

import { Chain, Token, FiatCurrency } from "@/types/ramp";

export const CHAINS: Chain[] = [
  { id: "Arbitrum", name: "Arbitrum" },
  { id: "Ethereum", name: "Ethereum" },
  { id: "Base", name: "Base" },
  { id: "Polygon", name: "Polygon" },
  { id: "Solana", name: "Solana" },
];

export const TOKENS: Token[] = [
  { id: "USDC", name: "USDC" },
  { id: "USDT", name: "USDT" },
  { id: "EUR", name: "EUR (Stablecoin)" },
];

export const FIAT_CURRENCIES_FALLBACK: FiatCurrency[] = [
  { id: "EUR", name: "EUR", symbol: "€" },
  { id: "USD", name: "USD", symbol: "$" },
  { id: "GBP", name: "GBP", symbol: "£" },
];

export const FIAT_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  BRL: "R$",
  MXN: "$",
};
