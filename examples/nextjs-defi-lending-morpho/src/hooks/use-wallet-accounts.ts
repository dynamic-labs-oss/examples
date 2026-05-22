"use client";

import { useWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { isEvmWalletAccount, type EvmWalletAccount } from "@dynamic-labs-sdk/evm";

export function useEvmWalletAccount(): EvmWalletAccount | null {
  return useWalletAccounts().find(isEvmWalletAccount) ?? null;
}
