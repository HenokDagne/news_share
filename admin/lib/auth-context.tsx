'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiRequest } from './api';

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  avatarUrl?: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' | 'AUDITOR';
  status: string;
  mustChangePassword?: boolean;
  permissions: string[];
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<AdminUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = async (): Promise<AdminUser | null> => {
    try {
      const staffMe = await apiRequest<AdminUser>('/admin/me');
      setUser(staffMe);
      localStorage.setItem('news_share_admin_user', JSON.stringify(staffMe));
      return staffMe;
    } catch {
      setUser(null);
      localStorage.removeItem('news_share_admin_user');
      localStorage.removeItem('news_share_admin_token');
      return null;
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('news_share_admin_token');
    if (savedToken) {
      setToken(savedToken);
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const isLoginPage = pathname === '/login';
      if (!user && !isLoginPage) {
        router.push('/login');
      } else if (user && isLoginPage) {
        router.push('/');
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string): Promise<AdminUser> => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        profile: any;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('news_share_admin_token', res.accessToken);
      setToken(res.accessToken);

      // Verify staff permissions and load admin profile
      const staffUser = await apiRequest<AdminUser>('/admin/me', {
        headers: { Authorization: `Bearer ${res.accessToken}` },
      });

      if (staffUser.role === 'USER') {
        localStorage.removeItem('news_share_admin_token');
        throw new Error('Access denied: Staff privileges required to access the admin portal.');
      }

      setUser(staffUser);
      localStorage.setItem('news_share_admin_user', JSON.stringify(staffUser));
      return staffUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('news_share_admin_token');
    localStorage.removeItem('news_share_admin_user');
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return user.permissions?.includes(permission) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
