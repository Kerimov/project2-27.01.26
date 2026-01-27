import React from 'react';
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
 
export type AppTextVariant = 'title' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'caption' | 'mono';
 
export type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  color?: 'text' | 'mutedText' | 'primary' | 'danger' | 'success' | 'warning';
  style?: StyleProp<TextStyle>;
};
 
export function AppText({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  const theme = useAppTheme();
  return (
    <Text
      style={[
        styles.base,
        { color: theme.colors[color], fontFamily: theme.typography.fontFamily },
        theme.typography[variant],
        style,
      ]}
      {...rest}
    />
  );
}
 
const styles = StyleSheet.create({
  base: {},
});

