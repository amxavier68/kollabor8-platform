import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';
import type { 
  UserProfile, 
  LoginRequest, 
  RegisterRequest,
  TwoFactorSetupResponse 
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    requires2FA: false,
    tempToken: null,
  });

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        requires2FA: false,
        tempToken: null,
      });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const initializeAuth = async () => {
    try {
      if (authService.isAuthenticated()) {
        const user = await authService.getProfile();
        setState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
        }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = async (data: LoginRequest) => {
    try {
      const response = await authService.login(data);

      if (response.requires2FA) {
        setState(prev => ({
          ...prev,
          requires2FA: true,
          tempToken: response.tempToken || null,
        }));
        return;
      }

      if (response.user) {
        setState(prev => ({
          ...prev,
          user: response.user!,
          isAuthenticated: true,
          requires2FA: false,
          tempToken: null,
        }));
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const verify2FA = async (code: string) => {
    try {
      if (!state.tempToken) {
        throw new Error('No 2FA session found');
      }

      const response = await authService.verify2FA({
        token: state.tempToken,
        code,
      });

      if (response.user) {
        setState(prev => ({
          ...prev,
          user: response.user!,
          isAuthenticated: true,
          requires2FA: false,
          tempToken: null,
        }));
      }
    } catch (error) {
      console.error('2FA verification failed:', error);
      throw error;
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      await authService.register(data);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
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
    try {
      const user = await authService.getProfile();
      setState(prev => ({ ...prev, user }));
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  const setup2FA = async (): Promise<TwoFactorSetupResponse> => {
    try {
      const response = await authService.setup2FA();
      await refreshUser();
      return response;
    } catch (error) {
      console.error('Failed to setup 2FA:', error);
      throw error;
    }
  };

  const disable2FA = async (password: string) => {
    try {
      await authService.disable2FA(password);
      await refreshUser();
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      throw error;
    }
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
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
