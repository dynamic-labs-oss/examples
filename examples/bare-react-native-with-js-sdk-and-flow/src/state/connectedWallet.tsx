/**
 * The one wallet this app is connected to, shared across screens.
 *
 * Deposit and Withdraw both need it, and the connect screen is a third
 * screen that produces it, so it cannot live in either route's state. The
 * wallet option is kept alongside the account because the account carries an
 * address and a chain but no name or mark to show the user.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { WalletAccount, WalletOption } from '@dynamic-labs-sdk/client';
import { useRemoveWalletAccount } from '@dynamic-labs-sdk/react-hooks';

export type ConnectedWallet = {
  account: WalletAccount;
  option: WalletOption;
};

type ConnectedWalletContextValue = {
  connectedWallet?: ConnectedWallet;
  setConnectedWallet: (wallet: ConnectedWallet) => void;
  disconnect: () => void;
};

const ConnectedWalletContext = createContext<
  ConnectedWalletContextValue | undefined
>(undefined);

export function ConnectedWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet>();
  const { mutate: removeWalletAccount } = useRemoveWalletAccount();

  const value = useMemo(
    () => ({
      connectedWallet,
      setConnectedWallet,
      disconnect: () => {
        if (!connectedWallet) {
          return;
        }

        // Only forget the wallet once the SDK has actually let go of it.
        // Dropping it here first would leave a live session behind a screen
        // that says there is none, and the next connect would resolve
        // against that session instead of pairing afresh.
        removeWalletAccount(
          { walletAccount: connectedWallet.account },
          { onSuccess: () => setConnectedWallet(undefined) },
        );
      },
    }),
    [connectedWallet, removeWalletAccount],
  );

  return (
    <ConnectedWalletContext.Provider value={value}>
      {children}
    </ConnectedWalletContext.Provider>
  );
}

export function useConnectedWallet(): ConnectedWalletContextValue {
  const value = useContext(ConnectedWalletContext);

  if (!value) {
    throw new Error(
      'useConnectedWallet must be used inside a ConnectedWalletProvider.',
    );
  }

  return value;
}
