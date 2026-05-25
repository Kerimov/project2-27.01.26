import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Должно совпадать с tabBarStyle в app/(tabs)/_layout.tsx */
export const FLOATING_TAB_BAR = {
  marginBottom: 8,
  height: 74,
  fabGap: 12,
  fabSize: 56,
} as const;

export function getFloatingTabBarHeight(safeBottom = 0) {
  return FLOATING_TAB_BAR.marginBottom + FLOATING_TAB_BAR.height + safeBottom;
}

export function useFloatingTabBarInsets() {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const tabBarHeight = getFloatingTabBarHeight(insets.bottom);
    const fabBottom = tabBarHeight + FLOATING_TAB_BAR.fabGap;
    const listPaddingBottom =
      fabBottom + FLOATING_TAB_BAR.fabSize + FLOATING_TAB_BAR.fabGap + 8;

    return {
      tabBarHeight,
      fabBottom,
      listPaddingBottom,
    };
  }, [insets.bottom]);
}
