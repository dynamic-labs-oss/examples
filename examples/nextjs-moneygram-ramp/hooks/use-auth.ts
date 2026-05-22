"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isSignedIn, onEvent } from "@dynamic-labs-sdk/client";
import { dynamicClient, initDynamic } from "@/lib/dynamic";

const AUTH_EVENTS = [
  "userChanged",
  "walletAccountsChanged",
  "logout",
  "tokenChanged",
] as const;

function subscribe(callback: () => void): () => void {
  const unsubs = AUTH_EVENTS.map((event) =>
    onEvent({ event, listener: callback }, dynamicClient),
  );
  return () => unsubs.forEach((u) => u?.());
}

export function useAuth(): boolean {
  // Trigger init on mount (idempotent)
  useEffect(() => {
    void initDynamic();
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => isSignedIn(dynamicClient),
    () => false,
  );
}
