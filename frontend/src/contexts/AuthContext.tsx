// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';
import type {
  UserProfile,
  LoginRequest,
  RegisterRequest,
  TwoFactorSetupResponse,
} from '../types';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requires2FA: boolean;
  tempToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setup2FA: () => Promise<TwoFactorSetupResponse>;
  disable2FA: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    requires2FA: false,
    tempToken: null,
  });

  // --- Effects ---
  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () =>
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        requires2FA: false,
        tempToken: null,
      });

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () =>
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // --- Auth methods ---
  const initializeAuth = async () => {
    try {
      if (authService.isAuthenticated()) {
        const user = await authService.getProfile();
        setState((prev) => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
        }));
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const login = async (data: LoginRequest) => {
    try {
      const response = await authService.login(data);
      if (response.requires2FA) {
        setState((prev) => ({
          ...prev,
          requires2FA: true,
          tempToken: response.tempToken || null,
        }));
        return;
      }
      if (response.user) {
        setState((prev) => ({
          ...prev,
          user: response.user!,
          isAuthenticated: true,
          requires2FA: false,
          tempToken: null,
        }));
      }
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      throw error;
    }
  };

  const verify2FA = async (code: string) => {
    if (!state.tempToken) throw new Error('No 2FA session found');
    const response = await authService.verify2FA({
      token: state.tempToken,
      code,
    });
    if (response.user) {
      setState((prev) => ({
        ...prev,
        user: response.user!,
        isAuthenticated: true,
        requires2FA: false,
        tempToken: null,
      }));
    }
  };

  const register = async (data: RegisterRequest) => {
    await authService.register(data);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        requires2FA: false,
        tempToken: null,
      });
    }
  };

  const refreshUser = async () => {
    const user = await authService.getProfile();
    setState((prev) => ({ ...prev, user }));
  };

  const setup2FA = async (): Promise<TwoFactorSetupResponse> => {
    const response = await authService.setup2FA();
    await refreshUser();
    return response;
  };

  const disable2FA = async (password: string) => {
    await authService.disable2FA(password);
    await refreshUser();
  };

  const value: AuthContextType = {
    ...state,
    login,
    verify2FA,
    register,
    logout,
    refreshUser,
    setup2FA,
    disable2FA,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export { AuthProvider, useAuth };
