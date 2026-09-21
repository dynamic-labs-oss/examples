import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../consts/theme';

type ScreenProps = {
  children: React.ReactNode;
  /**
   * Wraps content in a ScrollView + keyboard-dismiss-on-tap-outside, for
   * screens with a text input that can end up behind the keyboard (Deposit,
   * Withdraw). Screens with no input (Home, Splash, FlowStatus) don't need
   * this.
   */
  scrollsWithKeyboard?: boolean;
};

/**
 * Every full-bleed route renders its content inside this instead of a bare
 * View — it owns safe-area insets and (optionally) the keyboard-avoidance/
 * dismiss-on-tap behavior that used to live once in App.tsx (see its
 * pre-redesign AppContent, which wrapped its single screen in
 * KeyboardAvoidingView + ScrollView + TouchableWithoutFeedback). Now that
 * each screen is its own route instead of one component swapping content,
 * that behavior has to be available per-screen rather than once at the top.
 */
export function Screen({ children, scrollsWithKeyboard = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddedContent = (
    <View
      style={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom },
      ]}
    >
      {children}
    </View>
  );

  if (!scrollsWithKeyboard) {
    return <View style={styles.screen}>{paddedContent}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flexOne}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
        >
          {paddedContent}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
});
