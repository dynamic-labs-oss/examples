"use client";

import { useSyncExternalStore } from "react";
import { getWalletAccounts, onEvent, type WalletAccount } from "@dynamic-labs-sdk/client";
import { dynamicClient } from "@/lib/dynamic";

function subscribe(callback: () => void): () => void {
  const unsub = onEvent(
    { event: "walletAccountsChanged", listener: callback },
    dynamicClient,
  );
  return () => unsub?.();
}

export function useWalletAccounts(): WalletAccount[] {
  return useSyncExternalStore(
    subscribe,
    () => getWalletAccounts(dynamicClient),
    () => [],
  );
}
