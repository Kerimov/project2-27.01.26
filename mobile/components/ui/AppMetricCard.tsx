import React from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';

import { useAppTheme } from '@/design/tokens';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Tone = 'primary' | 'ai' | 'success' | 'warning' | 'danger' | 'info';

type AppMetricCardProps = Omit<PressableProps, 'style'> & {
  label: string;
  value: string | number;
  caption?: string;
  icon?: Parameters<typeof IconSymbol>[0]['name'];
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

export function AppMetricCard({
  label,
  value,
  caption,
  icon,
  tone = 'primary',
  style,
  disabled,
  ...rest
}: AppMetricCardProps) {
  const theme = useAppTheme();
  const color = theme.colors[tone];
  const soft = theme.colors[`${tone}Soft` as keyof typeof theme.colors] || theme.colors.primarySoft;

  const content = (
    <AppCard variant="glass" style={[{ flex: 1, minHeight: 132 }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText variant="caption" color="mutedText">
            {label}
          </AppText>
          <AppText variant="title" style={{ color }}>
            {value}
          </AppText>
          {caption ? (
            <AppText variant="caption" color="mutedText">
              {caption}
            </AppText>
          ) : null}
        </View>
        {icon ? (
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: theme.radius.pill,
              backgroundColor: soft as string,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <IconSymbol name={icon} size={20} color={color} />
          </View>
        ) : null}
      </View>
    </AppCard>
  );

  if (disabled || !rest.onPress) return content;

  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.9 : 1 }]} {...rest}>
      {content}
    </Pressable>
  );
}
