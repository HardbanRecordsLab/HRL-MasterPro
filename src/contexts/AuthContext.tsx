// src/contexts/AuthContext.tsx
// Feature: hrl-ecosystem-deployment
// IDENTYCZNY we wszystkich 9 frontendach — nie modyfikować per-app
// v2: Cookie-based SSO — login on WP, cookie shared across all subdomains

import React, { createContext, useContext, useEffect, useState } from 'react';

const ACCESS_MANAGER_URL = import.meta.env.VITE_ACCESS_MANAGER_URL as string;
const WP_LOGIN_URL = import.meta.env.VITE_WP_LOGIN_URL as string;

interface User {
  userId: string;
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'label';
  credits: number;
  expiresAt?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Loading spinner ───────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh',
    background: '#0a0a0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <div style={{
      width: '40px', height: '40px',
      border: '3px solid rgba(168,85,247,0.3)',
      borderTop: '3px solid #a855f7',
      borderRadius: '50%',
      animation: 'hrl-spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes hrl-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── AuthProvider ──────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifyToken = async (): Promise<void> => {
    try {
      const res = await fetch(`${ACCESS_MANAGER_URL}/api/auth/verify`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 401) {
        // Redirect to WP login with return URL
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `${WP_LOGIN_URL}?redirect_to=${returnUrl}`;
        return;
      }
      if (res.ok) {
        setUser(await res.json());
      }
    } catch {
      // Network error — keep loading state, retry
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const res = await fetch(`${ACCESS_MANAGER_URL}/api/auth/refresh`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        setUser(null);
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `${WP_LOGIN_URL}?redirect_to=${returnUrl}`;
        return;
      }
      if (res.ok) setUser(await res.json());
    } catch {}
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${ACCESS_MANAGER_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      window.location.href = WP_LOGIN_URL;
    }
  };

  useEffect(() => {
    verifyToken();
    const interval = setInterval(refreshSession, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
