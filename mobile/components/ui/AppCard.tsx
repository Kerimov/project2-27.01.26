import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
 
export type AppCardProps = ViewProps & {
  variant?: 'surface' | 'surface2';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};
 
export function AppCard({ variant = 'surface', padded = true, style, ...rest }: AppCardProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors[variant],
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
        theme.shadow as any,
        padded ? { padding: theme.spacing.lg } : null,
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

