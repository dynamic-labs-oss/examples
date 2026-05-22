"use client";

import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { dynamicClient } from "@/lib/dynamic";
import type { Wallet } from "@dynamic-labs/client";

export function useEvmWalletAccount(): Wallet | null {
  const client = useReactiveClient(dynamicClient);
  return client.wallets.userWallets?.find((w) => w.chain === "EVM") ?? null;
}
