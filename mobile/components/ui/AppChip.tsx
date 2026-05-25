import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
 
export type AppChipProps = Omit<PressableProps, 'style'> & {
  label: string;
  tone?: 'neutral' | 'primary' | 'ai' | 'success' | 'warning' | 'danger' | 'info';
  style?: StyleProp<ViewStyle>;
};
 
export function AppChip({ label, tone = 'neutral', style, ...rest }: AppChipProps) {
  const theme = useAppTheme();
  const bg =
    tone === 'primary'
      ? theme.colors.primary
      : tone === 'ai'
        ? theme.colors.aiSoft
        : tone === 'success'
          ? theme.colors.successSoft
          : tone === 'warning'
            ? theme.colors.warningSoft
            : tone === 'danger'
              ? theme.colors.dangerSoft
              : tone === 'info'
                ? theme.colors.infoSoft
                : theme.colors.surface2;
  const text =
    tone === 'primary'
      ? '#fff'
      : tone === 'ai'
        ? theme.colors.ai
        : tone === 'success'
          ? theme.colors.success
          : tone === 'warning'
            ? theme.colors.warning
            : tone === 'danger'
              ? theme.colors.danger
              : tone === 'info'
                ? theme.colors.info
                : theme.colors.text;
  const border = tone === 'primary' ? 'transparent' : theme.colors.border;
 
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: theme.radius.pill,
          minHeight: 32,
          paddingVertical: 7,
          paddingHorizontal: 11,
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

