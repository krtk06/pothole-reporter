import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, clearTokens } from './api';
import type { User } from '../types';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  isAuthenticated: boolean;
  isHydrated: boolean;
  reportsVersion: number;
  setUser: (user: User | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  bumpReportsVersion: () => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  theme: 'dark',
  isAuthenticated: false,
  isHydrated: false,
  reportsVersion: 0,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setTheme: (theme) => {
    set({ theme });
    void SecureStore.setItemAsync('theme', theme);
  },
  bumpReportsVersion: () => set((state) => ({ reportsVersion: state.reportsVersion + 1 })),

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Local logout must still succeed even if the server is unreachable.
    } finally {
      await clearTokens();
      set({ user: null, isAuthenticated: false, isHydrated: true });
    }
  },

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, storedTheme] = await Promise.all([
        SecureStore.getItemAsync('accessToken'),
        SecureStore.getItemAsync('refreshToken'),
        SecureStore.getItemAsync('theme'),
      ]);

      if (accessToken && refreshToken) {
        try {
          const data = await api('/auth/me');
          const user = data.user || data;
          set({ user, isAuthenticated: true, theme: (storedTheme || user.theme_preference || 'dark') as 'light' | 'dark', isHydrated: true });
          return;
        } catch {
          await Promise.all([
            SecureStore.deleteItemAsync('accessToken'),
            SecureStore.deleteItemAsync('refreshToken'),
          ]);
        }
      }

      if (storedTheme) {
        set({ theme: storedTheme as 'light' | 'dark' });
      }

      set({ isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },
}));
