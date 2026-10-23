"use client";

import { useCallback } from "react";
import {
  getWalletAccounts,
  isSignedIn,
  logout,
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { useGetWalletAccounts, useUser } from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamic";

export function useWallet() {
  const { data: user } = useUser();
  const { data: walletAccounts = [] } = useGetWalletAccounts();
  const loggedIn = (user ?? null) !== null;
  const solanaAccount = walletAccounts.find(isSolanaWalletAccount) ?? null;

  const disconnect = useCallback(async () => {
    await logout(dynamicClient);
  }, []);

  const ensureSolanaWallet = useCallback(async () => {
    try {
      const accounts = getWalletAccounts(dynamicClient);
      if (!accounts.some(isSolanaWalletAccount) && isSignedIn(dynamicClient)) {
        await createWaasWalletAccounts({ chains: ["SOL"] }, dynamicClient);
      }
    } catch {}
  }, []);

  return { solanaAccount, loggedIn, ensureSolanaWallet, disconnect };
}
