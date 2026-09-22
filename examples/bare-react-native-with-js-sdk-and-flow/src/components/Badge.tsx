import React from 'react';
import { StyleSheet, Text } from 'react-native';

/** Small status pill, e.g. the "Installed" marker on a wallet row. */
export function Badge({ children }: { children: string }) {
  return <Text style={styles.badge}>{children}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    // The ink at 10% alpha rather than a solid tint, so the pill composites
    // correctly over the row's pressed fill.
    backgroundColor: 'rgba(79, 99, 201, 0.1)',
    color: '#4F63C9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
});
