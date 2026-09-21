/**
 * Home screen: a title and two buttons, Deposit and Withdraw. This app has
 * no account/vault to show a balance or address for anymore — it's a pure
 * "connect MetaMask and move USDC on Base" demo, so Home is just the two
 * entry points. Purely prop-driven, no hooks — HomeRoute wires the two
 * callbacks straight to navigation.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { spacing, typography, colors } from '../consts/theme';

type HomeViewProps = {
  onDeposit: () => void;
  onWithdraw: () => void;
};

export function HomeView({ onDeposit, onWithdraw }: HomeViewProps) {
  return (
    <Screen>
      <Header title="Flow + MetaMask Demo" />

      <View style={styles.body}>
        <Text style={styles.hint}>
          Connect MetaMask to deposit or withdraw USDC on Base.
        </Text>

        <PrimaryButton
          title="Deposit"
          style={styles.actionSpacing}
          onPress={onDeposit}
        />
        <SecondaryButton
          title="Withdraw"
          style={styles.actionSpacing}
          onPress={onWithdraw}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  hint: {
    ...typography.body,
    color: colors.foregroundSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  actionSpacing: {
    marginTop: spacing.md,
  },
});
