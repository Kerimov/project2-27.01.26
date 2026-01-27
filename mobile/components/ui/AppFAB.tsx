import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
 
import { useAppTheme } from '@/design/tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
 
export type AppFABProps = Omit<PressableProps, 'style'> & {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  style?: StyleProp<ViewStyle>;
};
 
export function AppFAB({ icon, style, ...rest }: AppFABProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.pill,
          opacity: pressed ? 0.92 : 1,
          bottom: 16 + (insets.bottom || 0),
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
    bottom: 16,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

