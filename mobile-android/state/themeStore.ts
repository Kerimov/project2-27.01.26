import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type ThemeScheme = 'light' | 'dark';

const STORAGE_KEY = 'app_color_scheme';

type ThemeState = {
  scheme: ThemeScheme;
  hydrated: boolean;
  bootstrap: () => Promise<void>;
  setScheme: (scheme: ThemeScheme) => Promise<void>;
  toggleScheme: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  scheme: 'light',
  hydrated: false,

  bootstrap: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const scheme: ThemeScheme = saved === 'dark' ? 'dark' : 'light';
      set({ scheme, hydrated: true });
    } catch {
      set({ scheme: 'light', hydrated: true });
    }
  },

  setScheme: async (scheme) => {
    set({ scheme });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      /* ignore */
    }
  },

  toggleScheme: async () => {
    const next: ThemeScheme = get().scheme === 'light' ? 'dark' : 'light';
    await get().setScheme(next);
  },
}));
