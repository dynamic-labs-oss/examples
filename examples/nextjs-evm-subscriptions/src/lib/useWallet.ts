"use client";

import { useCallback } from "react";
import {
  getWalletAccounts,
  isSignedIn,
  logout,
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { useGetWalletAccounts, useUser } from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamic";

export function useWallet() {
  const { data: user } = useUser();
  const { data: walletAccounts = [] } = useGetWalletAccounts();
  const loggedIn = (user ?? null) !== null;
  const evmAccount = walletAccounts.find(isEvmWalletAccount) ?? null;

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  const ensureEvmWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      if (!accounts.some(isEvmWalletAccount) && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["EVM"] }, dynamicClient);
      }
    } catch {}
  }, []);

  return { evmAccount, loggedIn, ensureEvmWallet, disconnect };
}
