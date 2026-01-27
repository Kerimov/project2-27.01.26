import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { AuthUser } from '../api/auth';
import { login as apiLogin } from '../api/auth';
import { me as apiMe } from '../api/me';
import { setAuthToken } from '../api/client';

const STORAGE_TOKEN_KEY = 'auth_token';
const STORAGE_USER_KEY = 'auth_user';

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;

  bootstrap: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isBootstrapping: true,
  isLoading: false,
  error: null,

  bootstrap: async () => {
    try {
      set({ isBootstrapping: true, error: null });
      const token = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
      if (!token) {
        set({ user: null, token: null, isBootstrapping: false });
        return false;
      }

      setAuthToken(token);
      // Проверяем токен через /api/auth/me
      const { user } = await apiMe();
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));

      set({ user, token, isBootstrapping: false });
      return true;
    } catch {
      // Токен битый/просроченный — чистим
      setAuthToken(null);
      await AsyncStorage.multiRemove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);
      set({ user: null, token: null, isBootstrapping: false });
      return false;
    }
  },

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const data = await apiLogin(email, password);
      setAuthToken(data.token);
      await AsyncStorage.setItem(STORAGE_TOKEN_KEY, data.token);
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isLoading: false });
      return true;
    } catch (e: any) {
      const msg = e?.payload?.error || e?.payload?.message || e?.message || 'Ошибка входа';
      set({ isLoading: false, error: msg });
      return false;
    }
  },

  logout: async () => {
    setAuthToken(null);
    await AsyncStorage.multiRemove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);
    set({ user: null, token: null });
  },
}));

