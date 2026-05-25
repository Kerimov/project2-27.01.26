import React from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/design/tokens';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol } from '@/components/ui/icon-symbol';

type AppEmptyStateProps = {
  title: string;
  subtitle?: string;
  icon?: Parameters<typeof IconSymbol>[0]['name'];
  actionTitle?: string;
  onAction?: () => void;
};

export function AppEmptyState({ title, subtitle, icon = 'sparkles', actionTitle, onAction }: AppEmptyStateProps) {
  const theme = useAppTheme();

  return (
    <AppCard variant="glass">
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.aiSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <IconSymbol name={icon} size={26} color={theme.colors.ai} />
        </View>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="h3" style={{ textAlign: 'center' }}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="mutedText" style={{ textAlign: 'center' }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {actionTitle && onAction ? <AppButton title={actionTitle} variant="ai" onPress={onAction} /> : null}
      </View>
    </AppCard>
  );
}
