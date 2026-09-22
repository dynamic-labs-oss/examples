/**
 * The chain picker, shown after a wallet that works on more than one chain
 * is chosen. Same row recipe as the wallet list, but not `ProviderListView`:
 * a chain is a handful of fixed options, so there is nothing to search or
 * collapse.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Chain } from '@dynamic-labs-sdk/client';
import {
  colors,
  pickerRow,
  pickerRowColors,
  typography,
} from '../consts/theme';
import { ChainMark } from '../components/ChainMark';

type WalletChainListViewProps = {
  chains: Chain[];
  onSelectChain: (chain: Chain) => void;
};

/**
 * Display names for the chains this app can run a Flow on. A wallet
 * supporting anything else falls back to the raw chain code.
 */
const CHAIN_LABELS: Partial<Record<Chain, string>> = {
  EVM: 'Ethereum',
  SOL: 'Solana',
};

export function WalletChainListView({
  chains,
  onSelectChain,
}: WalletChainListViewProps) {
  return (
    <View style={styles.list}>
      {chains.map(chain => (
        <Pressable
          key={chain}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => onSelectChain(chain)}
        >
          <ChainMark chain={chain} />
          <Text style={styles.name}>{CHAIN_LABELS[chain] ?? chain}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pickerRow.gap,
    height: pickerRow.height,
    paddingLeft: pickerRow.paddingLeft,
    paddingRight: pickerRow.paddingRight,
    borderRadius: pickerRow.radius,
    backgroundColor: pickerRowColors.surface,
  },
  rowPressed: {
    backgroundColor: pickerRowColors.surfacePressed,
  },
  name: {
    ...typography.body,
    color: colors.foreground,
  },
});
