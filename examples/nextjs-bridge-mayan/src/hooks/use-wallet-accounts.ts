"use client";

import { useSyncExternalStore } from "react";
import { getWalletAccounts, onEvent } from "@dynamic-labs-sdk/client";
import { isEvmWalletAccount, type EvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { dynamicClient } from "@/lib/dynamic";

function subscribe(callback: () => void): () => void {
  const unsub = onEvent(
    { event: "walletAccountsChanged", listener: callback },
    dynamicClient,
  );
  return () => unsub?.();
}

export function useEvmWalletAccount(): EvmWalletAccount | null {
  return useSyncExternalStore(
    subscribe,
    () => getWalletAccounts(dynamicClient).find(isEvmWalletAccount) ?? null,
    () => null,
  );
}
