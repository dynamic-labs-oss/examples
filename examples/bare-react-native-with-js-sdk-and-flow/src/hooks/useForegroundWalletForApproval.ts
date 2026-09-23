/**
 * Brings the connected wallet app to the front whenever it is waiting on the
 * user to approve something.
 *
 * WalletConnect wallets are reached over a relay, so asking one to sign puts
 * the request in its inbox and nothing happens on screen — the user has to
 * open the wallet themselves to find it. Without this the Flow submit step
 * sits on "check your wallet" forever. MetaMask's own pairing SDK opens
 * itself, so only the WalletConnect path needs this.
 */
import { useOnEvent } from '@dynamic-labs-sdk/react-hooks';
import { Linking } from 'react-native';

export function useForegroundWalletForApproval(): void {
  useOnEvent({
    event: 'walletConnectUserActionRequested',
    listener: ({ walletMetadata }) => {
      const redirect =
        walletMetadata.redirect?.native ?? walletMetadata.redirect?.universal;

      if (!redirect) {
        return;
      }

      // A wallet that cannot be reopened is not an error worth surfacing —
      // the request still reaches it, the user just has to switch apps by
      // hand.
      Linking.openURL(redirect).catch(() => undefined);
    },
  });
}
