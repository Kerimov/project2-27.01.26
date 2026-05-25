import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_TAB_BAR, useFloatingTabBarInsets } from '@/design/tab-bar';
import { useAppTheme } from '@/design/tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type AppFABProps = Omit<PressableProps, 'style'> & {
  icon?: Parameters<typeof IconSymbol>[0]['name'];
  /** Учитывать плавающую нижнюю панель вкладок (по умолчанию да) */
  aboveTabBar?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppFAB({ icon = 'plus', aboveTabBar = true, style, ...rest }: AppFABProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { fabBottom } = useFloatingTabBarInsets();

  const bottom = aboveTabBar ? fabBottom : 16 + (insets.bottom || 0);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.ai,
          borderRadius: theme.radius.pill,
          width: FLOATING_TAB_BAR.fabSize,
          height: FLOATING_TAB_BAR.fabSize,
          opacity: pressed ? 0.92 : 1,
          bottom,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        theme.shadow as any,
        style,
      ]}
      {...rest}>
      <IconSymbol name={icon} size={24} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 8,
  },
});
