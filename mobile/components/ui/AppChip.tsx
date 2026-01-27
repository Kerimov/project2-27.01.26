import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
 
export type AppChipProps = Omit<PressableProps, 'style'> & {
  label: string;
  tone?: 'neutral' | 'primary';
  style?: StyleProp<ViewStyle>;
};
 
export function AppChip({ label, tone = 'neutral', style, ...rest }: AppChipProps) {
  const theme = useAppTheme();
  const bg = tone === 'primary' ? theme.colors.primary : theme.colors.surface2;
  const text = tone === 'primary' ? '#fff' : theme.colors.text;
  const border = tone === 'primary' ? 'transparent' : theme.colors.border;
 
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: theme.radius.pill,
          paddingVertical: 6,
          paddingHorizontal: 10,
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
      {...rest}>
      <AppText variant="caption" style={{ color: text }}>
        {label}
      </AppText>
    </Pressable>
  );
}
 
const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
});

