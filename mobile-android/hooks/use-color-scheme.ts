import { useThemeStore } from '@/state/themeStore';

export function useColorScheme(): 'light' | 'dark' {
  const scheme = useThemeStore((s) => s.scheme);
  const hydrated = useThemeStore((s) => s.hydrated);
  if (!hydrated) return 'light';
  return scheme;
}
