import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
 
export type Breakpoint = 'phone' | 'tablet' | 'desktop';
 
// Conservative breakpoints that work well for Android phones/tablets.
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;
 
export function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}
 
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return useMemo(() => getBreakpoint(width), [width]);
}
 
export function useContentPadding() {
  const { width } = useWindowDimensions();
  const bp = useMemo(() => getBreakpoint(width), [width]);
 
  // Slightly larger padding on tablets/desktop; keep in sync across screens.
  const horizontal = bp === 'phone' ? 16 : bp === 'tablet' ? 24 : 28;
  const vertical = bp === 'phone' ? 16 : 20;
  return { horizontal, vertical, breakpoint: bp };
}
 
export function useMaxContentWidth() {
  const { width } = useWindowDimensions();
  const bp = useMemo(() => getBreakpoint(width), [width]);
 
  // Keep content comfortably readable on tablets.
  const maxWidth = bp === 'phone' ? width : bp === 'tablet' ? 860 : 1040;
  return { maxWidth, breakpoint: bp };
}
 
// Gentle font scaling clamp to avoid huge fonts on some Android shells.
export function useFontScaleClamp(min = 0.95, max = 1.15) {
  const scale = PixelRatio.getFontScale?.() ?? 1;
  return Math.max(min, Math.min(max, scale));
}

