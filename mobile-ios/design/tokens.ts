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
  const background = isDark ? '#0E1624' : '#F7FAFC';
  const backgroundAlt = isDark ? '#121C2E' : '#EFF6FB';
  const surface = isDark ? '#172033' : '#FFFFFF';
  const surface2 = isDark ? '#1E2A3F' : '#F2F7FB';
  const surface3 = isDark ? '#243048' : '#E8F1F7';
  const surfaceGlass = isDark ? 'rgba(23, 32, 51, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const border = isDark ? 'rgba(179, 191, 207, 0.18)' : 'rgba(23, 37, 84, 0.12)';
  const borderStrong = isDark ? 'rgba(91, 163, 255, 0.32)' : 'rgba(17, 98, 183, 0.24)';
  const mutedText = isDark ? '#A8B3C2' : '#526172';

  const primary = isDark ? '#5B9FEF' : '#1162B7';
  const primary2 = isDark ? '#9B8AE8' : '#5B4BC4';
  const primarySoft = isDark ? 'rgba(91, 159, 239, 0.16)' : 'rgba(17, 98, 183, 0.10)';
  const ai = isDark ? '#9B8AE8' : '#5B4BC4';
  const aiSoft = isDark ? 'rgba(155, 138, 232, 0.18)' : 'rgba(91, 75, 196, 0.10)';
  const danger = isDark ? '#F97066' : '#B42318';
  const dangerSoft = isDark ? 'rgba(249, 112, 102, 0.16)' : 'rgba(180, 35, 24, 0.10)';
  const success = isDark ? '#32D583' : '#067647';
  const successSoft = isDark ? 'rgba(50, 213, 131, 0.14)' : 'rgba(6, 118, 71, 0.10)';
  const warning = isDark ? '#FDB022' : '#B54708';
  const warningSoft = isDark ? 'rgba(253, 176, 34, 0.16)' : 'rgba(181, 71, 8, 0.12)';
  const info = isDark ? '#53B1FD' : '#175CD3';
  const infoSoft = isDark ? 'rgba(83, 177, 253, 0.16)' : 'rgba(23, 92, 211, 0.10)';

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
      shadowColor: isDark ? '#000' : '#16324F',
      shadowOpacity: isDark ? 0.28 : 0.06,
      shadowRadius: isDark ? 14 : 12,
      shadowOffset: { width: 0, height: isDark ? 8 : 6 },
    },
    android: {
      elevation: isDark ? 4 : 2,
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
