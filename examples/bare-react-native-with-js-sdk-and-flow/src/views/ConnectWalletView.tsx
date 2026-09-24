/**
 * The connect screen: one of the three picker layouts, under a header whose
 * title and Back follow the step. Prop-driven like every view here —
 * ConnectWalletRoute owns the step and the actions.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Chain, WalletOption } from '@dynamic-labs-sdk/client';
import { Header } from '../components/Header';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProviderIcon } from '../components/ProviderIcon';
import { Screen } from '../components/Screen';
import { spacing } from '../consts/theme';
import type { ConnectWalletStep } from '../hooks/useConnectWalletFlow';
import { ProviderListView, type ProviderListItem } from './ProviderListView';
import { WalletChainListView } from './WalletChainListView';
import { WalletConnectionStatusView } from './WalletConnectionStatusView';

/** Rows shown before the rest of the catalogue collapses behind a footer. */
const DEFAULT_VISIBLE_WALLET_COUNT = 8;

type ConnectWalletViewProps = {
  step: ConnectWalletStep;
  /** The whole catalogue, already narrowed to what this app can connect. */
  walletOptions: WalletOption[];
  isLoadingWalletOptions: boolean;
  /** The wallet being connected, once one is picked. */
  wallet?: WalletOption;
  onSelectWallet: (option: WalletOption) => void;
  onSelectChain: (chain: Chain) => void;
  onTryAgain: () => void;
  onBack: () => void;
};

const STATUS_MESSAGES: Record<
  'connecting' | 'connected' | 'error',
  (walletName: string) => string
> = {
  connected: name => `${name} connected.`,
  connecting: name => `Approve the connection in ${name} to continue.`,
  error: name => `${name} didn’t connect. Please try again.`,
};

export function ConnectWalletView({
  step,
  walletOptions,
  isLoadingWalletOptions,
  wallet,
  onSelectWallet,
  onSelectChain,
  onTryAgain,
  onBack,
}: ConnectWalletViewProps) {
  const [searchText, setSearchText] = useState('');

  const title =
    step === 'chain-picker' ? 'Choose a network' : wallet?.name ?? 'Connect';

  const items: ProviderListItem[] = walletOptions.map(option => ({
    icon: <ProviderIcon name={option.name} url={option.iconUrl} />,
    id: option.key,
    name: option.name,
    onPress: () => onSelectWallet(option),
  }));

  return (
    <Screen>
      <Header
        title={step === 'list' ? 'Connect a wallet' : title}
        // Nothing to go back to once the wallet is connected — the route
        // leaves the screen on its own.
        onBack={step === 'connected' ? undefined : onBack}
      />

      <View style={styles.body}>
        {step === 'list' ? (
          <ProviderListView
            items={items}
            searchText={searchText}
            onChangeSearchText={setSearchText}
            searchPlaceholder="Search for wallets"
            defaultVisibleCount={DEFAULT_VISIBLE_WALLET_COUNT}
            remainingNoun="Wallets"
            isLoading={isLoadingWalletOptions}
            emptyText="No wallets available"
          />
        ) : null}

        {step === 'chain-picker' && wallet ? (
          <WalletChainListView
            chains={wallet.supportedChains}
            onSelectChain={onSelectChain}
          />
        ) : null}

        {step !== 'list' && step !== 'chain-picker' && wallet ? (
          <WalletConnectionStatusView
            walletName={wallet.name}
            walletIconUrl={wallet.iconUrl}
            indicator={step === 'connecting' ? 'pending' : step === 'connected' ? 'success' : 'error'}
            message={STATUS_MESSAGES[step](wallet.name)}
            actions={
              step === 'error' ? (
                <PrimaryButton title="Try again" onPress={onTryAgain} />
              ) : undefined
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: spacing.sm,
  },
});
