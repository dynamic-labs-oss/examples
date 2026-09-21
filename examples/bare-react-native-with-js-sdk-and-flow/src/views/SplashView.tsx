import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { ErrorText } from '../components/ErrorText';
import { AlertCircleIcon } from '../components/icons';
import { colors, spacing, typography } from '../consts/theme';

type Props = {
  /** e.g. "Checking your session…" — optional, a bare spinner is fine
   * without it. Ignored once `error` is set. */
  message?: string;
  /** Set when the Dynamic client itself failed to initialize (bad/
   * unreachable environment config, offline cold boot) — a distinct,
   * unrecoverable-from-here state, not just "still loading." There's no
   * SDK-exposed way to retry initialization itself (it runs once at client
   * creation), so this has no Retry button — telling the user plainly what
   * happened, rather than offering a button with nothing real to call, is
   * the more honest failure mode. */
  error?: string;
};

/**
 * The very first thing the app can render, before it's even known whether
 * there's a session to resume — deliberately minimal: no Header, no back
 * button, no cancel action, since there's nothing yet to go back to or
 * cancel out of.
 */
export function SplashView({ message, error }: Props) {
  return (
    <Screen>
      <View style={styles.centered}>
        {error ? (
          <>
            <AlertCircleIcon size={56} color={colors.error} />
            <Text style={styles.errorTitle}>Couldn't start the app</Text>
            <ErrorText style={styles.errorText}>{error}</ErrorText>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  message: {
    color: colors.foregroundSecondary,
    marginTop: spacing.md,
    ...typography.body,
  },
  errorTitle: {
    color: colors.foreground,
    marginTop: spacing.md,
    textAlign: 'center',
    ...typography.headline,
  },
  errorText: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
