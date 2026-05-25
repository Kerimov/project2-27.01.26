import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
 
import { useAppTheme } from '@/design/tokens';
import { AppText } from '@/components/ui/AppText';
 
export type AppSectionProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  headerRight?: React.ReactNode;
};
 
export function AppSection({ title, subtitle, children, style, headerRight }: AppSectionProps) {
  const theme = useAppTheme();
  return (
    <View style={[{ gap: theme.spacing.md }, style]}>
      {(title || subtitle || headerRight) && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            {title ? <AppText variant="h2">{title}</AppText> : null}
            {subtitle ? (
              <AppText variant="caption" color="mutedText">
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {headerRight ? <View>{headerRight}</View> : null}
        </View>
      )}
      {children}
    </View>
  );
}

