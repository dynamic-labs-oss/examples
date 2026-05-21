"use client";

import { useSyncExternalStore } from "react";
import { getWalletAccounts, onEvent } from "@dynamic-labs-sdk/client";
import {
  isSolanaWalletAccount,
  type SolanaWalletAccount,
} from "@dynamic-labs-sdk/solana";
import { dynamicClient } from "@/lib/dynamic";

function subscribe(callback: () => void): () => void {
  const unsub = onEvent(
    { event: "walletAccountsChanged", listener: callback },
    dynamicClient,
  );
  return () => unsub?.();
}

export function useSolanaWalletAccount(): SolanaWalletAccount | null {
  return useSyncExternalStore(
    subscribe,
    () =>
      getWalletAccounts(dynamicClient).find(isSolanaWalletAccount) ?? null,
    () => null,
  );
}
