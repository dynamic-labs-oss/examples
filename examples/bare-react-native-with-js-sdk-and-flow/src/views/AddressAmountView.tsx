/**
 * Dumb, prop-driven address + amount entry view — shared shape for Deposit
 * and Withdraw, which differ only in copy (title/hint) and in which asset
 * the connected wallet pays. Replaces the old vault-era AmountView.tsx: this
 * app no longer has a pre-known destination (the vault), so the destination
 * address is now a plain text field on this same screen.
 *
 * All flow mechanics (create -> attach source -> quote -> submit, validation,
 * busy state) stay in the route that renders this — this component only knows
 * about the two TextInputs, the hint/error text, and the action button, which
 * sends the user to the wallet picker until a wallet is connected and then
 * becomes the submit button in the same slot.
 */
import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ErrorText } from '../components/ErrorText';
import { Header } from '../components/Header';
import { LinkButton } from '../components/LinkButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, typography } from '../consts/theme';
import { shortAddress } from '../utils/shortAddress';

type Props = {
  title: string;
  hint: string;
  address: string;
  onChangeAddress: (value: string) => void;
  amount: string;
  onChangeAmount: (value: string) => void;
  /** Name and address of the connected wallet, or undefined when there is
   * none — which swaps the action button to "Connect a wallet". */
  connectedWallet?: { name: string; address: string };
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  stepLabel?: string;
  error?: string;
  amountErrorText?: string;
  onBack: () => void;
};

// decimal-pad has no return key on iOS to hit "Done" with, so this pairs the
// amount field with its own accessory toolbar above the keyboard as the way
// to dismiss it — same pattern as the old AmountView.tsx, just under this
// view's own nativeID so the two never collide if both somehow mounted at
// once.
const AMOUNT_INPUT_ACCESSORY_ID = 'address-amount-view-done';

export function AddressAmountView({
  title,
  hint,
  address,
  onChangeAddress,
  amount,
  onChangeAmount,
  connectedWallet,
  onConnectWallet,
  onDisconnectWallet,
  onSubmit,
  submitLabel,
  isSubmitting,
  canSubmit,
  stepLabel,
  error,
  amountErrorText,
  onBack,
}: Props) {
  const isBusy = isSubmitting;

  return (
    <Screen scrollsWithKeyboard={true}>
      {/* onBack is withheld while busy, same rule the old AmountView used —
       * the Header's Back is the only way out of this screen, so it has to
       * carry the "can't leave mid-connect/mid-submit" rule itself. */}
      <Header title={title} onBack={isBusy ? undefined : onBack} />

      <Text style={styles.label}>Destination address</Text>
      <TextInput
        style={styles.input}
        placeholder="0x…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        value={address}
        onChangeText={onChangeAddress}
        editable={!isBusy}
      />

      <Text style={styles.label}>Amount (USD)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        // decimal-pad, not numeric: numeric renders a full punctuation
        // keyboard on iOS, which is overkill for an amount field. The
        // device's own region setting decides whether that shows a period
        // or a comma as the decimal key — normalizing that is the caller's
        // job (see utils/normalizeAmount.ts), not this view's.
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={onChangeAmount}
        editable={!isBusy}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        inputAccessoryViewID={
          Platform.OS === 'ios' ? AMOUNT_INPUT_ACCESSORY_ID : undefined
        }
      />
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={AMOUNT_INPUT_ACCESSORY_ID}>
          <View style={styles.accessoryBar}>
            <LinkButton title="Done" onPress={Keyboard.dismiss} hitSlop={8} />
          </View>
        </InputAccessoryView>
      ) : null}

      <Text style={styles.hint}>{hint}</Text>

      {amountErrorText ? (
        <ErrorText style={styles.amountErrorSpaced}>
          {amountErrorText}
        </ErrorText>
      ) : null}

      {connectedWallet ? (
        <>
          <View style={styles.walletRow}>
            <Text style={styles.walletText} numberOfLines={1}>
              {connectedWallet.name} · {shortAddress(connectedWallet.address)}
            </Text>
            <LinkButton
              title="Disconnect"
              tone="danger"
              onPress={onDisconnectWallet}
              disabled={isBusy}
              hitSlop={8}
            />
          </View>
          <PrimaryButton
            title={submitLabel}
            loading={isSubmitting}
            disabled={!canSubmit}
            onPress={onSubmit}
          />
        </>
      ) : (
        <PrimaryButton title="Connect a wallet" onPress={onConnectWallet} />
      )}

      {isSubmitting && stepLabel ? (
        <Text style={styles.stepLabel}>{stepLabel}</Text>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.foregroundSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  hint: {
    ...typography.caption,
    color: colors.foregroundSecondary,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  amountErrorSpaced: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  walletText: {
    ...typography.label,
    color: colors.foregroundSecondary,
    flexShrink: 1,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.foregroundSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
