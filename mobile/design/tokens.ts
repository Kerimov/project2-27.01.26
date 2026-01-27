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
  const surface = isDark ? '#1C1F22' : '#FFFFFF';
  const surface2 = isDark ? '#23272B' : '#F6F8FA';
  const border = isDark ? '#2C3237' : '#E6E8EB';
  const mutedText = isDark ? '#AEB6BD' : '#66707A';
 
  const primary = base.tint; // keep existing accent
  const danger = '#E5484D';
  const success = '#2DA44E';
  const warning = '#E6A700';
 
  const radius = {
    xs: 8,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  } as const;
 
  const spacing = {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  } as const;
 
  // Typography is tuned for Android, iOS, and tablets.
  const typography = {
    fontFamily:
      Platform.select({
        ios: 'System',
        android: 'sans-serif',
        default: undefined,
      }) ?? undefined,
    title: { fontSize: Math.round(28 * fontScale), lineHeight: Math.round(34 * fontScale), fontWeight: '700' as const },
    h2: { fontSize: Math.round(20 * fontScale), lineHeight: Math.round(26 * fontScale), fontWeight: '700' as const },
    h3: { fontSize: Math.round(16 * fontScale), lineHeight: Math.round(22 * fontScale), fontWeight: '700' as const },
    body: { fontSize: Math.round(14 * fontScale), lineHeight: Math.round(20 * fontScale), fontWeight: '400' as const },
    bodyStrong: { fontSize: Math.round(14 * fontScale), lineHeight: Math.round(20 * fontScale), fontWeight: '600' as const },
    caption: { fontSize: Math.round(12 * fontScale), lineHeight: Math.round(16 * fontScale), fontWeight: '400' as const },
    mono: { fontSize: Math.round(12 * fontScale), lineHeight: Math.round(16 * fontScale), fontWeight: '400' as const },
  } as const;
 
  const shadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.22 : 0.08,
      shadowRadius: isDark ? 10 : 12,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: isDark ? 2 : 3,
    },
    default: {},
  });
 
  return {
    scheme,
    colors: {
      background: base.background,
      text: base.text,
      mutedText,
      surface,
      surface2,
      border,
      primary,
      danger,
      success,
      warning,
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

