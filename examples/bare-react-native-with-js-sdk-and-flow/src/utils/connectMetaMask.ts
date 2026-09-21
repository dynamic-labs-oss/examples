/**
 * Connects MetaMask for exactly one operation — never persisted to
 * Dynamic's wallet-account list (`addToDynamicWalletAccounts: false`).
 * Uses Dynamic's own MetaMask SDK wrapper, which pairs over a deep link
 * rather than the generic WalletConnect catalog.
 *
 * Deposit and Withdraw each call this fresh, with no "remember the last
 * wallet" state of their own. Every call starts a new pairing, so connecting
 * a second time in one app run opens MetaMask again instead of resolving
 * against the session the previous one left behind.
 */
import { appendConnectionUriToDeeplink } from '@dynamic-labs-sdk/client';
import { connectWithMetaMaskUriEvm } from '@dynamic-labs-sdk/evm/metamask';
import type { EvmWalletAccount } from '@dynamic-labs-sdk/evm';
import { Linking } from 'react-native';
import { resolveWalletAccounts } from './resolveWalletAccounts';

const METAMASK_DEEPLINK = 'https://metamask.app.link/wc';

export async function connectMetaMask(): Promise<EvmWalletAccount> {
  const { uri, approval } = await connectWithMetaMaskUriEvm({
    addToDynamicWalletAccounts: false,
  });
  const deeplink = appendConnectionUriToDeeplink({
    connectionUri: uri,
    deeplinkUrl: METAMASK_DEEPLINK,
  });
  Linking.openURL(deeplink);

  return resolveWalletAccounts(approval);
}
