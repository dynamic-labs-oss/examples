/**
 * Where a connection attempt lives once a wallet is picked: the wallet's
 * mark, a status line, and whatever the state allows the user to do about
 * it. `indicator` marks the mark — a ring spins while the wallet holds the
 * approval, a tick or an alert stamps its corner once it settles.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircleIcon, CheckCircleIcon } from '../components/icons';
import { SpinningRing } from '../components/SpinningRing';
import { ProviderIcon } from '../components/ProviderIcon';
import { colors, spacing, typography } from '../consts/theme';
import { RING_GAP } from '../components/SpinningRing';

type WalletConnectionStatusViewProps = {
  walletName: string;
  walletIconUrl?: string;
  indicator: 'pending' | 'success' | 'error';
  message: string;
  /** Lighter line under the message, for a caveat the message cannot carry. */
  secondaryMessage?: string;
  /** Buttons under the message, e.g. Try again. */
  actions?: React.ReactNode;
};

const ICON_SIZE = 48;
const RING_SIZE = ICON_SIZE + RING_GAP * 2;

export function WalletConnectionStatusView({
  walletName,
  walletIconUrl,
  indicator,
  message,
  secondaryMessage,
  actions,
}: WalletConnectionStatusViewProps) {
  return (
    <View style={styles.container}>
      <View
        style={styles.iconSlot}
        accessibilityRole="image"
        accessibilityLabel={walletName}
      >
        {indicator === 'pending' ? <SpinningRing size={RING_SIZE} /> : null}
        <ProviderIcon name={walletName} url={walletIconUrl} size={ICON_SIZE} />
        {indicator === 'success' ? (
          <View style={styles.stamp}>
            <CheckCircleIcon size={20} color={colors.success} />
          </View>
        ) : null}
        {indicator === 'error' ? (
          <View style={styles.stamp}>
            <AlertCircleIcon size={20} color={colors.error} />
          </View>
        ) : null}
      </View>

      {/* Announced on arrival: the mark and the ring carry no meaning to a
          screen reader. */}
      <Text
        style={styles.message}
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
      >
        {message}
      </Text>
      {secondaryMessage ? (
        <Text style={styles.secondaryMessage}>{secondaryMessage}</Text>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  iconSlot: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sits on the mark's corner, ringed in the page fill so it reads as a
  // stamp rather than part of the artwork.
  stamp: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.pageBackground,
    backgroundColor: colors.pageBackground,
  },
  message: {
    ...typography.bodyMedium,
    color: colors.foreground,
    textAlign: 'center',
    maxWidth: 300,
  },
  secondaryMessage: {
    ...typography.caption,
    color: colors.foregroundSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
