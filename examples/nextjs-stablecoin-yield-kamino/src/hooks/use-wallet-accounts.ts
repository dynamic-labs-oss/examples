"use client";

import { useWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { isSolanaWalletAccount, type SolanaWalletAccount } from "@dynamic-labs-sdk/solana";

export function useSolanaWalletAccount(): SolanaWalletAccount | null {
  return useWalletAccounts().find(isSolanaWalletAccount) ?? null;
}
