"use client";

import { useSyncExternalStore } from "react";
import { isSignedIn, onEvent } from "@dynamic-labs-sdk/client";
import { dynamicClient } from "@/lib/dynamic";

const AUTH_EVENTS = [
  "userChanged",
  "walletAccountsChanged",
  "logout",
  "initStatusChanged",
] as const;

function subscribe(callback: () => void): () => void {
  const unsubs = AUTH_EVENTS.map((event) =>
    onEvent({ event, listener: callback }, dynamicClient),
  );
  return () => unsubs.forEach((u) => u?.());
}

export function useAuth(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isSignedIn(dynamicClient),
    () => false,
  );
}
