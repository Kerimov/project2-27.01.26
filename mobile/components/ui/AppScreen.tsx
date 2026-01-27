import React from 'react';
import { ScrollView, ScrollViewProps, StyleProp, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
 
import { useAppTheme } from '@/design/tokens';
import { useContentPadding, useMaxContentWidth } from '@/design/responsive';
 
export type AppScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
};
 
export function AppScreen({
  children,
  scroll = true,
  contentContainerStyle,
  style,
  scrollProps,
}: AppScreenProps) {
  const theme = useAppTheme();
  const pad = useContentPadding();
  const { maxWidth } = useMaxContentWidth();
  const insets = useSafeAreaInsets();
 
  const content = (
    <View
      style={[
        {
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          paddingHorizontal: pad.horizontal,
          paddingTop: pad.vertical + insets.top,
          paddingBottom: pad.vertical + insets.bottom,
        },
        contentContainerStyle,
      ]}>
      {children}
    </View>
  );
 
  return (
    <SafeAreaView edges={[]} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          {...scrollProps}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

