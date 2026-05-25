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
  const background = isDark ? '#F7FAFC' : '#F7FAFC';
  const backgroundAlt = isDark ? '#EFF6FB' : '#EFF6FB';
  const surface = isDark ? '#FFFFFF' : '#FFFFFF';
  const surface2 = isDark ? '#F2F7FB' : '#F2F7FB';
  const surface3 = isDark ? '#E8F1F7' : '#E8F1F7';
  const surfaceGlass = isDark ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const border = isDark ? 'rgba(23, 37, 84, 0.12)' : 'rgba(23, 37, 84, 0.12)';
  const borderStrong = isDark ? 'rgba(17, 98, 183, 0.24)' : 'rgba(17, 98, 183, 0.24)';
  const mutedText = isDark ? '#526172' : '#526172';
 
  const primary = '#1162B7';
  const primary2 = '#5B4BC4';
  const primarySoft = 'rgba(17, 98, 183, 0.10)';
  const ai = '#5B4BC4';
  const aiSoft = 'rgba(91, 75, 196, 0.10)';
  const danger = '#B42318';
  const dangerSoft = 'rgba(180, 35, 24, 0.10)';
  const success = '#067647';
  const successSoft = 'rgba(6, 118, 71, 0.10)';
  const warning = '#B54708';
  const warningSoft = 'rgba(181, 71, 8, 0.12)';
  const info = '#175CD3';
  const infoSoft = 'rgba(23, 92, 211, 0.10)';
 
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
    body: { fontSize: Math.round(16 * fontScale), lineHeight: Math.round(24 * fontScale), fontWeight: '400' as const },
    bodyStrong: { fontSize: Math.round(16 * fontScale), lineHeight: Math.round(24 * fontScale), fontWeight: '700' as const },
    caption: { fontSize: Math.round(14 * fontScale), lineHeight: Math.round(20 * fontScale), fontWeight: '500' as const },
    mono: { fontSize: Math.round(12 * fontScale), lineHeight: Math.round(16 * fontScale), fontWeight: '400' as const },
  } as const;
 
  const shadow = Platform.select({
    ios: {
      shadowColor: '#16324F',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 2,
    },
    default: {},
  });
 
  return {
    scheme,
    colors: {
      background,
      backgroundAlt,
      text: '#172033',
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

