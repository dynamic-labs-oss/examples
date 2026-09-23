import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '../consts/theme';
import { SearchIcon } from './icons';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

/** A search glyph and an input inside one bordered plate. */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: SearchBarProps) {
  return (
    <View style={styles.bar}>
      <SearchIcon size={16} color={colors.muted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        // clearButtonMode is iOS-only; Android users clear with the keyboard.
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.foreground,
    // The plate owns the vertical rhythm, so the input keeps RN's default
    // text box height on Android instead of adding its own padding.
    paddingVertical: spacing.sm,
  },
});
