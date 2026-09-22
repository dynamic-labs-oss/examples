/**
 * A searchable list of pickable providers — wallets here, but nothing in it
 * is wallet-specific. Prop-driven like every other view in this app: the
 * search text and the items are the caller's state, this only renders them.
 *
 * Long catalogues (70-odd wallets on EVM alone) collapse to
 * `defaultVisibleCount` rows behind a "+N" footer, which expands on tap.
 * Searching bypasses the collapse and matches against the whole list.
 */
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProviderOption } from '../components/ProviderOption';
import { SearchBar } from '../components/SearchBar';
import {
  colors,
  pickerRow,
  pickerRowColors,
  spacing,
  typography,
} from '../consts/theme';

export type ProviderListItem = {
  id: string;
  name: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  onPress: () => void;
};

type ProviderListViewProps = {
  items: ProviderListItem[];
  searchText: string;
  onChangeSearchText: (value: string) => void;
  searchPlaceholder: string;
  /** Rows shown before the rest collapse behind the footer. */
  defaultVisibleCount: number;
  /** Plural noun the footer counts, e.g. "Wallets". */
  remainingNoun: string;
  /** Renders placeholder rows instead of items. */
  isLoading?: boolean;
  /** Shown when there are no items at all — not when a search misses. */
  emptyText: string;
};

// Enough to look like a list without committing to a count the real data
// has not supplied yet.
const PLACEHOLDER_ROW_COUNT = 5;

export function ProviderListView({
  items,
  searchText,
  onChangeSearchText,
  searchPlaceholder,
  defaultVisibleCount,
  remainingNoun,
  isLoading = false,
  emptyText,
}: ProviderListViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const query = searchText.trim().toLowerCase();
  const isSearching = query !== '';
  const matches = isSearching
    ? items.filter(item => item.name.toLowerCase().includes(query))
    : items;

  const isCollapsed =
    !isSearching && !isExpanded && items.length > defaultVisibleCount;
  const visible = isCollapsed ? matches.slice(0, defaultVisibleCount) : matches;
  const remainingCount = items.length - defaultVisibleCount;

  if (isLoading) {
    return (
      <View style={styles.rows}>
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_, index) => (
          <View key={index} style={styles.placeholderRow} />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={visible}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.rows}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <SearchBar
          value={searchText}
          onChangeText={onChangeSearchText}
          placeholder={searchPlaceholder}
        />
      }
      ListHeaderComponentStyle={styles.header}
      renderItem={({ item }) => (
        <ProviderOption
          icon={item.icon}
          name={item.name}
          badge={item.badge}
          onPress={item.onPress}
        />
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {isSearching ? `No matches for “${searchText}”` : emptyText}
        </Text>
      }
      ListFooterComponent={
        isCollapsed ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.footerRow,
              pressed && styles.footerRowPressed,
            ]}
            onPress={() => setIsExpanded(true)}
          >
            <Text style={styles.footerText}>
              +{remainingCount} {remainingNoun}
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: 6,
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.sm,
  },
  empty: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  // Same box as a real row, so nothing jumps once the catalogue lands.
  placeholderRow: {
    height: pickerRow.height,
    borderRadius: pickerRow.radius,
    backgroundColor: pickerRowColors.surface,
  },
  footerRow: {
    height: pickerRow.height,
    borderRadius: pickerRow.radius,
    backgroundColor: pickerRowColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRowPressed: {
    backgroundColor: pickerRowColors.surfacePressed,
  },
  footerText: {
    ...typography.body,
    color: colors.foregroundSecondary,
  },
});
