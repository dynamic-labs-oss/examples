import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../consts/theme';

type LinkButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /**
   * 'accent' for a plain link (e.g. the keyboard accessory's "Done"),
   * 'danger' for a destructive action (e.g. "Disconnect").
   */
  tone?: 'accent' | 'danger';
  hitSlop?: number;
};

/**
 * Bare text button with no fill or border — a tap target that's just a
 * Text with a pressed-opacity feedback. Consolidates App.tsx's "Disconnect"
 * (danger) and WithdrawalForm.tsx's keyboard-accessory "Done" (accent),
 * which had drifted to the point that "Done" had no pressed feedback at
 * all.
 */
export function LinkButton({
  title,
  onPress,
  disabled = false,
  tone = 'accent',
  hitSlop,
}: LinkButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.text,
            tone === 'danger' ? styles.dangerText : styles.accentText,
            pressed && styles.textPressed,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  accentText: {
    color: colors.accent,
    fontSize: 16,
  },
  dangerText: {
    color: colors.error,
  },
  textPressed: {
    opacity: 0.6,
  },
});
