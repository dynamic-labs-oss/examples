/**
 * Brings the connected wallet app to the front whenever it is waiting on the
 * user to approve something.
 *
 * WalletConnect wallets are reached over a relay, so asking one to sign puts
 * the request in its inbox and nothing happens on screen — the user has to
 * open the wallet themselves to find it. Without this the Flow submit step
 * sits on "check your wallet" forever. MetaMask's own pairing SDK opens
 * itself, so only the WalletConnect path needs this.
 *
 * The wallet catalogue's own link comes first: every WalletConnect wallet in
 * it has one, while the `redirect` a wallet reports about itself is optional
 * and often empty.
 */
import { getPreferredWalletDeepLink } from '@dynamic-labs-sdk/client';
import { useOnEvent } from '@dynamic-labs-sdk/react-hooks';
import { Linking } from 'react-native';
import { useConnectedWallet } from '../state/connectedWallet';

async function openFirstLink(links: (string | undefined)[]): Promise<void> {
  for (const link of links) {
    if (!link) {
      continue;
    }

    try {
      await Linking.openURL(link);

      return;
    } catch {
      // Falls through to the next link.
    }
  }
}

export function useForegroundWalletForApproval(): void {
  const { connectedWallet } = useConnectedWallet();

  useOnEvent({
    event: 'walletConnectUserActionRequested',
    listener: ({ walletMetadata }) => {
      const connectionOption = connectedWallet?.option.connectionOptions.find(
        option =>
          option.type === 'walletConnect' &&
          option.chain === connectedWallet.account.chain,
      );

      const catalogueLink =
        connectionOption && 'deeplinks' in connectionOption
          ? getPreferredWalletDeepLink({
              deeplinks: connectionOption.deeplinks,
            })
          : undefined;

      // Tried in order, falling back when a link fails to open. A wallet
      // that cannot be reopened at all is not an error worth surfacing —
      // the request still reaches it, the user just switches apps by hand.
      openFirstLink([
        catalogueLink,
        walletMetadata.redirect?.native,
        walletMetadata.redirect?.universal,
      ]).catch(() => undefined);
    },
  });
}
