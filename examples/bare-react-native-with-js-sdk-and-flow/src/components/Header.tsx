import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../consts/theme';
import { ChevronLeftIcon } from './icons';

type HeaderProps = {
  title: string;
  /** Renders a back chevron + "Back" that calls this when tapped. Omit on
   * screens with nothing to go back to (Splash, the first screen of a
   * stack). */
  onBack?: () => void;
  /** A single trailing affordance, e.g. Home's account icon button. Kept to
   * one slot, not a generic children/icon-row API — every screen in this
   * app needs at most one. */
  right?: React.ReactNode;
};

/**
 * Every full-bleed screen renders its own Header rather than relying on
 * native-stack's built-in one (navigation.tsx sets `headerShown: false`) —
 * this app's redesign wants full control over the header's look (no native
 * chrome/back-button styling to fight), and a single shared component here
 * keeps that consistent across ~10 screens instead of each reinventing it.
 */
export function Header({ title, onBack, right }: HeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={onBack}
            hitSlop={8}
          >
            <ChevronLeftIcon size={20} color={colors.accent} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Equal-width side slots keep `title` visually centered regardless of
  // whether onBack/right are present — a plain 3-cell flex row without this
  // would shift the title left/right depending on which slots are filled.
  side: {
    minWidth: 56,
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backText: {
    color: colors.accent,
    ...typography.bodyMedium,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.foreground,
    ...typography.headline,
  },
});
