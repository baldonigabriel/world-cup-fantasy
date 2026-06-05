import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface AuthUser {
  id: string;
  username: string;
  teamName: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, teamName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      async login(username, password) {
        const data = await api.post<TokenResponse>('/auth/login', { username, password });
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      },

      async register(username, teamName, password) {
        const data = await api.post<TokenResponse>('/auth/register', {
          username,
          teamName,
          password,
        });
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      },

      async logout() {
        const { refreshToken } = get();
        if (refreshToken) {
          await api.post('/auth/logout', {}, refreshToken).catch(() => {});
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },

      async refreshTokens() {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('no refresh token');

        const data = await api.post<TokenResponse>('/auth/refresh', {}, refreshToken);
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      },
    }),
    {
      name: 'wcf-auth',
      // Only persist refresh token — access token lives in memory
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
