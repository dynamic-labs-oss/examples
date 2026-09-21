import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '../consts/theme';

type CopyButtonProps = {
  title: string;
  onPress: () => void;
};

/**
 * Small bordered chip button, purely presentational — FlowStatusScreen's
 * CopyRow owns the actual clipboard write + "Copied!" label swap and just
 * passes the current label down.
 */
export function CopyButton({ title, onPress }: CopyButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonPressed: {
    backgroundColor: colors.divider,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
});
