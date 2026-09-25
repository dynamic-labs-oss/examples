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
  | 'not-installed'
  | 'error';

/**
 * How long a pairing URI can be reopened. WalletConnect expires a pairing
 * proposal after five minutes, so this leaves a minute of margin before the
 * wallet would be handed a URI it can no longer answer.
 */
const PAIRING_URI_REUSE_MS = 4 * 60 * 1000;

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
  // Counts every pairing minted, renewals included, so only the newest one's
  // link and failure reach the screen.
  const attemptRef = useRef(0);
  const chainRef = useRef<Chain | undefined>(undefined);
  // The pairing link of the attempt in flight, kept so the user can reopen
  // the wallet after leaving it without approving — the pairing is still
  // waiting on the relay.
  const pairingRef = useRef<{ openedAt: number; uri: string } | undefined>(
    undefined,
  );

  function startConnection(
    option: WalletOption,
    chain: Chain,
    { renewing = false }: { renewing?: boolean } = {},
  ) {
    // Renewing keeps the attempt the user started: the earlier pairing stays
    // live until it expires, so approving it still has to count.
    if (!renewing) {
      generationRef.current += 1;
    }

    attemptRef.current += 1;
    const generation = generationRef.current;
    const attempt = attemptRef.current;
    chainRef.current = chain;
    pairingRef.current = undefined;
    setStep('connecting');

    const isCurrentAttempt = () => generationRef.current === generation;
    const isLatestPairing = () =>
      isCurrentAttempt() && attemptRef.current === attempt;

    connectWalletOption(
      {
        chain,
        // On a phone this is the wallet's own deeplink, so opening it hands
        // the pairing straight to the wallet app. There is no QR step: the
        // code would be on the same screen as the wallet meant to scan it.
        onConnectionUri: ({ uri }) => {
          if (!isLatestPairing()) {
            return;
          }

          pairingRef.current = { openedAt: Date.now(), uri };
          // Failing to open the link means the wallet app is not on this
          // device, so the user is offered its store page instead.
          Linking.openURL(uri).catch(() => {
            if (isLatestPairing()) {
              setStep('not-installed');
            }
          });
        },
        walletKey: option.key,
        walletOptionsCatalogue: catalogue,
      },
      {
        onError: () => {
          if (isLatestPairing()) {
            setStep('error');
          }
        },
        onSuccess: account => {
          if (!isCurrentAttempt()) {
            return;
          }

          // Ends the attempt, so the other pairing's late settle can no
          // longer move the screen.
          generationRef.current += 1;
          setStep('connected');
          onConnected({ account, option });
        },
      },
    );
  }

  function openInstallationPage(option: WalletOption) {
    const installationUrl =
      option.installationUrls &&
      getInstallationLinkForCurrentPlatform({
        installationUrls: option.installationUrls,
      });

    if (installationUrl) {
      Linking.openURL(installationUrl).catch(() => undefined);
    }
  }

  function selectWallet(option: WalletOption) {
    // A wallet with no connection option is offered as an install link —
    // the user does not have it on this device.
    if (option.connectionOptions.length === 0) {
      openInstallationPage(option);

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

  function openWalletAgain() {
    const pairing = pairingRef.current;

    // Past its window the pairing is about to expire, so a fresh one is
    // minted rather than handing the wallet a link it cannot answer.
    if (!pairing || Date.now() - pairing.openedAt > PAIRING_URI_REUSE_MS) {
      if (wallet && chainRef.current) {
        startConnection(wallet, chainRef.current, { renewing: true });
      }

      return;
    }

    const generation = generationRef.current;

    Linking.openURL(pairing.uri).catch(() => {
      if (generationRef.current === generation) {
        setStep('not-installed');
      }
    });
  }

  function installWallet() {
    if (wallet) {
      openInstallationPage(wallet);
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
    installWallet,
    isCatalogueLoading,
    openWalletAgain,
    selectChain,
    selectWallet,
    step,
    tryAgain,
    wallet,
  };
}
