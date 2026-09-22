/**
 * A chain's brand mark, sized for a picker row.
 *
 * Only the chains this app can run a Flow on have one. Anything else renders
 * an empty slot of the same size, so the rows stay aligned rather than this
 * app guessing at a mark it does not have.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Chain } from '@dynamic-labs-sdk/client';
import { pickerRow } from '../consts/theme';
import { EthereumIcon, SolanaIcon } from './icons';

export function ChainMark({ chain }: { chain: Chain }) {
  if (chain === 'EVM') {
    return <EthereumIcon size={pickerRow.iconSize} />;
  }

  if (chain === 'SOL') {
    return <SolanaIcon size={pickerRow.iconSize} />;
  }

  return <View style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  placeholder: {
    width: pickerRow.iconSize,
    height: pickerRow.iconSize,
  },
});
