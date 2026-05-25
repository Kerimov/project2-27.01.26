import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
 
export type AppCardProps = ViewProps & {
  variant?: 'surface' | 'surface2' | 'glass' | 'hero' | 'metric' | 'interactive';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};
 
export function AppCard({ variant = 'surface', padded = true, style, ...rest }: AppCardProps) {
  const theme = useAppTheme();
  const backgroundColor =
    variant === 'glass' || variant === 'hero'
      ? theme.colors.surfaceGlass
      : variant === 'metric'
        ? theme.colors.primarySoft
        : variant === 'interactive'
          ? theme.colors.surface2
          : theme.colors[variant];
  const borderColor = variant === 'hero' || variant === 'metric' ? theme.colors.borderStrong : theme.colors.border;
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderRadius: variant === 'hero' ? theme.radius.xxl : theme.radius.lg,
        },
        theme.shadow as any,
        padded ? { padding: variant === 'hero' ? theme.spacing.xl : theme.spacing.lg } : null,
        style,
      ]}
      {...rest}
    />
  );
}
 
const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});

