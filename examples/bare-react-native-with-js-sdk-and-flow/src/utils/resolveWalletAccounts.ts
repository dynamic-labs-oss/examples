/**
 * Used by connectMetaMask: MetaMask's connect flow resolves to
 * `approval()` resolving `{ walletAccounts }` — a real, typed guarantee from
 * the SDK (`WalletProviderUriConnectionResult`), not a coincidence this
 * relies on informally.
 */
import {
  isEvmWalletAccount,
  type EvmWalletAccount,
} from '@dynamic-labs-sdk/evm';
import type { WalletAccount } from '@dynamic-labs-sdk/client';

export async function resolveWalletAccounts(
  approval: () => Promise<{ walletAccounts: WalletAccount[] }>,
): Promise<EvmWalletAccount> {
  const { walletAccounts } = await approval();
  const account = walletAccounts[0];
  if (!account || !isEvmWalletAccount(account)) {
    throw new Error('Wallet connected, but no EVM account was returned.');
  }
  return account;
}
