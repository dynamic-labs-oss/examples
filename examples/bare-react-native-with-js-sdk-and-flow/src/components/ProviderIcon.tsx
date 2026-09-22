/**
 * A wallet's mark, fetched from the URL the wallet catalogue supplies.
 *
 * Three renderers rather than one: catalogue icons are mostly SVG, which
 * React Native's Image cannot decode, so those go through SvgUri; anything
 * else is a normal Image; and either failing falls back to a monogram, which
 * is also what an entry with no icon at all gets.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { colors, pickerRow } from '../consts/theme';

type ProviderIconProps = {
  /** Display name. Its initial is the monogram fallback. */
  name: string;
  /** Icon URL from the wallet catalogue. */
  url?: string;
  size?: number;
};

function isSvgUrl(url: string): boolean {
  // Split on both, since a mark can arrive with a query, a fragment, or
  // neither — and reading past either one stops the extension matching.
  return url.split(/[?#]/)[0]!.toLowerCase().endsWith('.svg');
}

export function ProviderIcon({
  name,
  url,
  size = pickerRow.iconSize,
}: ProviderIconProps) {
  // Tracks which URL failed rather than whether one did, so a row that
  // re-renders with a different icon gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string>();
  const hasIcon = !!url && url !== failedUrl;

  // Proportional squircle, so the corner follows the icon size.
  const plate = { width: size, height: size, borderRadius: size * 0.225 };

  if (!hasIcon) {
    return (
      <View style={[styles.plate, styles.monogramPlate, plate]}>
        <Text style={[styles.monogram, { fontSize: size * 0.4 }]}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.plate, plate]}>
      {isSvgUrl(url) ? (
        <SvgUri
          width={size}
          height={size}
          uri={url}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size }}
          onError={() => setFailedUrl(url)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Only the monogram gets the ink plate: marks ship transparent, so filling
  // behind one puts a fox in a black box.
  monogramPlate: {
    backgroundColor: colors.foreground,
  },
  monogram: {
    color: colors.onAccent,
    fontWeight: '600',
  },
});
