/**
 * Connects MetaMask for exactly one operation — never persisted to
 * Dynamic's wallet-account list (`addToDynamicWalletAccounts: false`).
 * Uses Dynamic's own MetaMask SDK wrapper (a deep link, not the generic
 * WalletConnect catalog, which this app no longer connects to at all).
 *
 * Deposit and Withdraw each call this fresh, with no "remember the last
 * wallet" state of their own — but the MetaMask controller this wraps is a
 * singleton cached for the app's entire lifetime
 * (`getOrCreateMetaMaskEvmController`), and its `connect()` only resets a
 * session it catches mid-"connecting"; an already-`"connected"` session is
 * left alone. So a *second* connect within the same app run (no force-quit
 * in between — e.g. Deposit, back to Home, then Withdraw) resolves against
 * that still-live session without ever emitting a new `display_uri`, which
 * `connectWithMetaMaskUriEvm` surfaces as `MetaMaskDisplayUriMissingError`
 * instead of "already connected, here's the account" — there's no public
 * API in this SDK version to force the underlying session closed first (see
 * git history for why an earlier `discardEphemeralWallet.ts` was removed as
 * a no-op). Since the wallet genuinely is still connected in that case, this
 * reuses the last resolved account instead of surfacing that as a failure.
 */
import { appendConnectionUriToDeeplink } from '@dynamic-labs-sdk/client';
import {
  connectWithMetaMaskUriEvm,
  MetaMaskDisplayUriMissingError,
} from '@dynamic-labs-sdk/evm/metamask';
import type { EvmWalletAccount } from '@dynamic-labs-sdk/evm';
import { Linking } from 'react-native';
import { resolveWalletAccounts } from './resolveWalletAccounts';

const METAMASK_DEEPLINK = 'https://metamask.app.link/wc';

let lastConnectedAccount: EvmWalletAccount | undefined;

export async function connectMetaMask(): Promise<EvmWalletAccount> {
  try {
    const { uri, approval } = await connectWithMetaMaskUriEvm({
      addToDynamicWalletAccounts: false,
    });
    const deeplink = appendConnectionUriToDeeplink({
      connectionUri: uri,
      deeplinkUrl: METAMASK_DEEPLINK,
    });
    Linking.openURL(deeplink);
    const account = await resolveWalletAccounts(approval);
    lastConnectedAccount = account;
    return account;
  } catch (error) {
    if (
      error instanceof MetaMaskDisplayUriMissingError &&
      lastConnectedAccount
    ) {
      return lastConnectedAccount;
    }
    throw error;
  }
}
