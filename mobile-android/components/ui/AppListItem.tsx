import React from 'react';
import { Pressable, PressableProps, View } from 'react-native';

import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol } from '@/components/ui/icon-symbol';

type AppListItemProps = Omit<PressableProps, 'children'> & {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: Parameters<typeof IconSymbol>[0]['name'];
};

export function AppListItem({ title, subtitle, meta, icon, disabled, ...rest }: AppListItemProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole={rest.onPress ? 'button' : undefined}
      disabled={disabled || !rest.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        opacity: pressed ? 0.78 : 1,
      })}
      {...rest}>
      {icon ? (
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <IconSymbol name={icon} size={20} color={theme.colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="mutedText" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {meta ? (
        <AppText variant="caption" color="mutedText">
          {meta}
        </AppText>
      ) : null}
      {rest.onPress ? <IconSymbol name="chevron.right" size={16} color={theme.colors.mutedText} /> : null}
    </Pressable>
  );
}
