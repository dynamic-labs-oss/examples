import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { colors, spacing } from '../consts/theme';

type ErrorTextProps = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
};

/**
 * Inline error message shown under a failed mutation/query. Extracted from
 * the `color: colors.error, fontSize: 13, marginTop: spacing.sm` Text that
 * had drifted into near-identical copies across App.tsx,
 * WithdrawalForm.tsx, and FlowStatusScreen.tsx — the latter also added an
 * extra marginBottom before its Retry button, so that stays available as a
 * style override rather than baked into the default.
 */
export function ErrorText({ children, style }: ErrorTextProps) {
  return <Text style={[styles.text, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});
