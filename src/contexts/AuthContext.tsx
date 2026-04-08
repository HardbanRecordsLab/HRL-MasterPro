// src/contexts/AuthContext.tsx
// Feature: hrl-ecosystem-deployment
// IDENTYCZNY we wszystkich 9 frontendach — nie modyfikować per-app
// Requirements: 3.3, 3.4, 3.5, 3.6, 3.8, 3.9, 3.10, 3.11

import React, { createContext, useContext, useEffect, useState } from 'react';

const ACCESS_MANAGER_URL = import.meta.env.VITE_ACCESS_MANAGER_URL as string;
const WP_LOGIN_URL = import.meta.env.VITE_WP_LOGIN_URL as string;

interface User {
  userId: string;
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'label';
  credits: number;
  expiresAt: string;
}

interface AuthContextValue {
  user: User | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const verifyToken = async (): Promise<void> => {
    try {
      const res = await fetch(`${ACCESS_MANAGER_URL}/api/auth/verify`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = WP_LOGIN_URL;
        return;
      }
      const data: User = await res.json();
      setUser(data);
    } catch {
      // Network error — do not redirect, keep existing state
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const res = await fetch(`${ACCESS_MANAGER_URL}/api/auth/refresh`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = WP_LOGIN_URL;
        return;
      }
      const data: User = await res.json();
      setUser(data);
    } catch {
      // Network error — do not redirect, keep existing state
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${ACCESS_MANAGER_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    verifyToken();
    const interval = setInterval(refreshSession, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
