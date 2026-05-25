import { useMemo } from 'react';
import { Platform } from 'react-native';
 
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFontScaleClamp } from '@/design/responsive';
 
export type AppColorScheme = 'light' | 'dark';
 
export type AppTheme = ReturnType<typeof createTheme>;
 
function createTheme(scheme: AppColorScheme, fontScale: number) {
  const base = Colors[scheme];
 
  const isDark = scheme === 'dark';
  const background = isDark ? '#0B1628' : '#F8FBFD';
  const backgroundAlt = isDark ? '#102039' : '#EEF8FF';
  const surface = isDark ? '#12213A' : '#FFFFFF';
  const surface2 = isDark ? '#1A2B47' : '#F1F7FB';
  const surface3 = isDark ? '#223553' : '#E7F1F8';
  const surfaceGlass = isDark ? 'rgba(24, 42, 70, 0.86)' : 'rgba(255, 255, 255, 0.94)';
  const border = isDark ? 'rgba(179, 191, 207, 0.22)' : 'rgba(20, 64, 96, 0.12)';
  const borderStrong = isDark ? 'rgba(103, 232, 249, 0.34)' : 'rgba(13, 139, 255, 0.26)';
  const mutedText = isDark ? '#B8C3D0' : '#536376';
 
  const primary = base.tint;
  const primary2 = isDark ? '#8B5CF6' : '#6D5DFB';
  const primarySoft = isDark ? 'rgba(103, 232, 249, 0.14)' : 'rgba(13, 139, 255, 0.10)';
  const ai = isDark ? '#A78BFA' : '#6952D9';
  const aiSoft = isDark ? 'rgba(167, 139, 250, 0.18)' : 'rgba(105, 82, 217, 0.09)';
  const danger = '#F04438';
  const dangerSoft = isDark ? 'rgba(240, 68, 56, 0.16)' : 'rgba(240, 68, 56, 0.10)';
  const success = '#12B76A';
  const successSoft = isDark ? 'rgba(18, 183, 106, 0.14)' : 'rgba(18, 183, 106, 0.10)';
  const warning = '#F79009';
  const warningSoft = isDark ? 'rgba(247, 144, 9, 0.16)' : 'rgba(247, 144, 9, 0.12)';
  const info = '#2E90FA';
  const infoSoft = isDark ? 'rgba(46, 144, 250, 0.16)' : 'rgba(46, 144, 250, 0.10)';
 
  const radius = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 22,
    xl: 28,
    xxl: 34,
    pill: 999,
  } as const;
 
  const spacing = {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 34,
  } as const;
 
  // Typography is tuned for Android, iOS, and tablets.
  const typography = {
    fontFamily:
      Platform.select({
        ios: 'System',
        android: 'sans-serif',
        default: undefined,
      }) ?? undefined,
    hero: { fontSize: Math.round(31 * fontScale), lineHeight: Math.round(38 * fontScale), fontWeight: '800' as const },
    title: { fontSize: Math.round(27 * fontScale), lineHeight: Math.round(34 * fontScale), fontWeight: '800' as const },
    h2: { fontSize: Math.round(22 * fontScale), lineHeight: Math.round(29 * fontScale), fontWeight: '800' as const },
    h3: { fontSize: Math.round(18 * fontScale), lineHeight: Math.round(25 * fontScale), fontWeight: '700' as const },
    body: { fontSize: Math.round(16 * fontScale), lineHeight: Math.round(23 * fontScale), fontWeight: '400' as const },
    bodyStrong: { fontSize: Math.round(16 * fontScale), lineHeight: Math.round(23 * fontScale), fontWeight: '700' as const },
    caption: { fontSize: Math.round(13 * fontScale), lineHeight: Math.round(18 * fontScale), fontWeight: '500' as const },
    mono: { fontSize: Math.round(12 * fontScale), lineHeight: Math.round(16 * fontScale), fontWeight: '400' as const },
  } as const;
 
  const shadow = Platform.select({
    ios: {
      shadowColor: isDark ? '#000' : '#0B3A5B',
      shadowOpacity: isDark ? 0.28 : 0.07,
      shadowRadius: isDark ? 14 : 14,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: isDark ? 4 : 3,
    },
    default: {},
  });
 
  return {
    scheme,
    colors: {
      background,
      backgroundAlt,
      text: base.text,
      mutedText,
      surface,
      surface2,
      surface3,
      surfaceGlass,
      border,
      borderStrong,
      primary,
      primary2,
      primarySoft,
      ai,
      aiSoft,
      danger,
      dangerSoft,
      success,
      successSoft,
      warning,
      warningSoft,
      info,
      infoSoft,
      icon: base.icon,
      tabIconDefault: base.tabIconDefault,
      tabIconSelected: base.tabIconSelected,
    },
    radius,
    spacing,
    typography,
    shadow,
  };
}
 
export function useAppTheme() {
  const scheme = (useColorScheme() ?? 'light') as AppColorScheme;
  const fontScale = useFontScaleClamp();
  return useMemo(() => createTheme(scheme, fontScale), [scheme, fontScale]);
}

