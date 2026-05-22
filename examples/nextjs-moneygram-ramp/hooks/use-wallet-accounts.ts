"use client";

import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { dynamicClient } from "@/lib/dynamic";
import type { Wallet } from "@dynamic-labs/client";

export function useWalletAccounts(): Wallet[] {
  const client = useReactiveClient(dynamicClient);
  return client.wallets.userWallets ?? [];
}
