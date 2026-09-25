/**
 * Formatting and Explorer Links
 *
 * Display helpers shared by every example. Chain-agnostic by virtue of exposing
 * one function per chain rather than switching internally.
 */

import { SOLANA_CLUSTER } from "../../constants";

/** Abbreviate an address for log output. */
export const formatAddress = (address: string) => {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
};

/*
 * Generates a block explorer link for a transaction hash on Base Sepolia
 */
export function getTransactionLink(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

/**
 * Generates a block explorer link for an address on Base Sepolia
 */
export function getAddressLink(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`;
}

/**
 * Generates a Solana explorer link for a transaction signature
 */
export function getSolanaTransactionLink(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_CLUSTER}`;
}

/**
 * Generates a Solana explorer link for an address
 */
export function getSolanaAddressLink(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${SOLANA_CLUSTER}`;
}
