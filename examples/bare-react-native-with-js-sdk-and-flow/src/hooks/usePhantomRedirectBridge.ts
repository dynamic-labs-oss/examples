/**
 * Hands Phantom's callback back to the SDK.
 *
 * Phantom has no relay and no WalletConnect entry: it answers by opening a
 * URL back into this app, and the pending connect or signature stays unsettled
 * until that URL reaches the SDK. React Native delivers it through `Linking`
 * rather than a page load, so nothing picks it up on its own — hence
 * `disableAutoRedirectCompletion` on the extension and this bridge instead.
 *
 * Both delivery routes are covered: `getInitialURL` for a callback that cold
 * started the app, and the `url` event for one that arrived while it was
 * already running.
 */
import { useEffect } from 'react';
import { Linking } from 'react-native';
import {
  completePhantomRedirect,
  detectPhantomRedirect,
} from '@dynamic-labs-sdk/solana';
import { useDynamicClient } from '@dynamic-labs-sdk/react-hooks';

export function usePhantomRedirectBridge(): void {
  const client = useDynamicClient();

  useEffect(() => {
    let isMounted = true;

    const handleUrl = async (incomingUrl: string) => {
      const url = new URL(incomingUrl);

      // Every deeplink into this app lands here, most of them from other
      // wallets returning the user rather than answering anything. Only a
      // Phantom callback with a request waiting on it gets completed.
      if (!(await detectPhantomRedirect({ url }, client))) {
        return;
      }

      // A rejection is Phantom's answer, not a fault to surface: the caller
      // waiting on the connection already sees it as a failed attempt.
      await completePhantomRedirect({ url }, client).catch(() => undefined);
    };

    Linking.getInitialURL().then(initialUrl => {
      if (isMounted && initialUrl) {
        handleUrl(initialUrl);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleUrl(url),
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [client]);
}
