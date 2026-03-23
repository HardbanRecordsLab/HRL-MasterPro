import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  email: string;
  credits: number;
  tier: string;
  is_premium: boolean;
  pmp_level?: string;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  logout: () => void;
  updateCredits: (credits: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: localStorage.getItem('hrl_sso_token'),
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('hrl_sso_token', token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem('hrl_sso_token');
        set({ token: null, user: null });
        window.location.href = 'https://hardbanrecordslab.online/moje-konto/';
      },
      updateCredits: (credits) => 
        set((state) => ({ 
          user: state.user ? { ...state.user, credits } : null 
        })),
    }),
    {
      name: 'hrl-unified-auth-storage',
    }
  )
);
