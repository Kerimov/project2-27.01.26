import React from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';

type Tone = 'neutral' | 'primary' | 'ai' | 'success' | 'warning' | 'danger' | 'info';

type AppStatusBadgeProps = {
  label: string;
  tone?: Tone;
};

export function AppStatusBadge({ label, tone = 'neutral' }: AppStatusBadgeProps) {
  const theme = useAppTheme();
  const bg =
    tone === 'neutral'
      ? theme.colors.surface2
      : (theme.colors[`${tone}Soft` as keyof typeof theme.colors] as string) || theme.colors.primarySoft;
  const color = tone === 'neutral' ? theme.colors.mutedText : (theme.colors[tone] as string);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        minHeight: 28,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <AppText variant="caption" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}
