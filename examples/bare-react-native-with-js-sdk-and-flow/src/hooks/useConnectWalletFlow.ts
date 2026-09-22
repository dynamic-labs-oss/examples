/**
 * Walks the user from the wallet list to a connected wallet: pick a wallet,
 * pick a chain when the wallet works on more than one, then wait while the
 * wallet holds the approval.
 *
 * Each attempt carries a generation number. An approval the user abandoned
 * can still settle minutes later, once they have already gone back and
 * picked something else — the stale settle is dropped rather than dragging
 * the screen back to a wallet they walked away from.
 */
import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import type { Chain, WalletOption } from '@dynamic-labs-sdk/client';
import { getInstallationLinkForCurrentPlatform } from '@dynamic-labs-sdk/client';
import {
  useConnectWalletOption,
  useGetWalletOptionsCatalogue,
} from '@dynamic-labs-sdk/react-hooks';
import { WALLET_CATALOGUE_PARAMS } from '../consts/walletCatalogue';
import type { ConnectedWallet } from '../state/connectedWallet';

export type ConnectWalletStep =
  | 'list'
  | 'chain-picker'
  | 'connecting'
  | 'connected'
  | 'error';

type UseConnectWalletFlowParams = {
  onConnected: (wallet: ConnectedWallet) => void;
};

export function useConnectWalletFlow({
  onConnected,
}: UseConnectWalletFlowParams) {
  const { data: catalogue, isPending: isCatalogueLoading } =
    useGetWalletOptionsCatalogue(WALLET_CATALOGUE_PARAMS);
  const { mutate: connectWalletOption } = useConnectWalletOption();

  const [step, setStep] = useState<ConnectWalletStep>('list');
  const [wallet, setWallet] = useState<WalletOption>();
  const generationRef = useRef(0);
  const chainRef = useRef<Chain | undefined>(undefined);

  function startConnection(option: WalletOption, chain: Chain) {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    chainRef.current = chain;
    setStep('connecting');

    const isCurrentAttempt = () => generationRef.current === generation;

    connectWalletOption(
      {
        chain,
        // On a phone this is the wallet's own deeplink, so opening it hands
        // the pairing straight to the wallet app. There is no QR step: the
        // code would be on the same screen as the wallet meant to scan it.
        onConnectionUri: ({ uri }) => {
          Linking.openURL(uri).catch(() => {
            if (isCurrentAttempt()) {
              setStep('error');
            }
          });
        },
        walletKey: option.key,
        walletOptionsCatalogue: catalogue,
      },
      {
        onError: () => {
          if (isCurrentAttempt()) {
            setStep('error');
          }
        },
        onSuccess: account => {
          if (!isCurrentAttempt()) {
            return;
          }

          setStep('connected');
          onConnected({ account, option });
        },
      },
    );
  }

  function selectWallet(option: WalletOption) {
    // A wallet with no connection option is offered as an install link —
    // the user does not have it on this device.
    if (option.connectionOptions.length === 0) {
      const installationUrl =
        option.installationUrls &&
        getInstallationLinkForCurrentPlatform({
          installationUrls: option.installationUrls,
        });

      if (installationUrl) {
        Linking.openURL(installationUrl).catch(() => undefined);
      }

      return;
    }

    setWallet(option);

    if (option.supportedChains.length > 1) {
      setStep('chain-picker');

      return;
    }

    startConnection(option, option.supportedChains[0]!);
  }

  function selectChain(chain: Chain) {
    if (wallet) {
      startConnection(wallet, chain);
    }
  }

  function tryAgain() {
    if (wallet && chainRef.current) {
      startConnection(wallet, chainRef.current);
    }
  }

  function goBackToList() {
    // Abandons the attempt in flight, so its settle can no longer move the
    // screen.
    generationRef.current += 1;
    setWallet(undefined);
    setStep('list');
  }

  return {
    catalogue,
    goBackToList,
    isCatalogueLoading,
    selectChain,
    selectWallet,
    step,
    tryAgain,
    wallet,
  };
}
