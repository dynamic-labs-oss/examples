import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  pickerRow,
  pickerRowColors,
  typography,
} from '../consts/theme';

type ProviderOptionProps = {
  /** The wallet's mark. */
  icon: React.ReactNode;
  name: string;
  /** Trailing marker, e.g. an "Installed" badge. */
  badge?: React.ReactNode;
  onPress: () => void;
};

/** One pickable wallet: mark, name, optional trailing badge. */
export function ProviderOption({
  icon,
  name,
  badge,
  onPress,
}: ProviderOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.lead}>
        {icon}
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {badge}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pickerRow.gap,
    height: pickerRow.height,
    paddingLeft: pickerRow.paddingLeft,
    paddingRight: pickerRow.paddingRight,
    borderRadius: pickerRow.radius,
    backgroundColor: pickerRowColors.surface,
  },
  rowPressed: {
    backgroundColor: pickerRowColors.surfacePressed,
  },
  // Shrinks before the badge does, so a long name truncates instead of
  // squeezing the marker off the row.
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pickerRow.gap,
    flexShrink: 1,
  },
  name: {
    ...typography.body,
    color: colors.foreground,
    flexShrink: 1,
  },
});
