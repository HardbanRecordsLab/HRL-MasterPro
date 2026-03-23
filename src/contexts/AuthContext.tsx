import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// URL do serwisu HRL Access Manager
const ACCESS_MANAGER_URL = import.meta.env.VITE_ACCESS_MANAGER_URL || 'http://localhost:9107';
const WP_LOGIN_URL = import.meta.env.VITE_WP_LOGIN_URL || 'https://hardbanrecordslab.online/wp-login.php';

interface User {
  userId: number | string;
  email: string;
  plan: string;
  credits: number;
  is_premium: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Funkcja pomocnicza do czytania ciasteczek (jeśli token jest np. pod nazwą jwt_token)
const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const verifyToken = async () => {
    try {
      // Pobieramy token z LocalStorage (zapasowo) lub Ciasteczka
      const token = localStorage.getItem('jwt_token') || getCookie('jwt_token');
      
      if (!token) {
        throw new Error('Brak tokenu autoryzacyjnego');
      }

      const response = await fetch(`${ACCESS_MANAGER_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Token nieważny lub wygasł');
      }

      const userData = await response.json();
      setUser(userData);
      setError(null);
    } catch (err: any) {
      console.error("SSO Auth Error:", err.message);
      setError(err.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Weryfikacja przy starcie
    verifyToken();

    // 2. Poll co 60 sekund (odświeżanie sesji i pobieranie najnowszego stanu kredytów)
    const intervalId = setInterval(verifyToken, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const login = () => {
    window.location.href = WP_LOGIN_URL;
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    document.cookie = 'jwt_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
    window.location.href = WP_LOGIN_URL;
  };

  const refreshCredits = async () => {
    await verifyToken();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
