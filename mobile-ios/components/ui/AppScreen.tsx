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
          paddingBottom: pad.vertical + insets.bottom + theme.spacing.xl,
        },
        contentContainerStyle,
      ]}>
      {children}
    </View>
  );
 
  return (
    <SafeAreaView edges={[]} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          right: -90,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor:
            theme.scheme === 'dark' ? 'rgba(91, 159, 239, 0.08)' : 'rgba(17, 98, 183, 0.035)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 120,
          left: -140,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor:
            theme.scheme === 'dark' ? 'rgba(155, 138, 232, 0.07)' : 'rgba(91, 75, 196, 0.028)',
        }}
      />
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

