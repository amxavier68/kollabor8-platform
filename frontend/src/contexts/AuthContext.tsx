// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.service'; // axios instance
import { jwtDecode } from "jwt-decode";

type LoginPayload = { email: string; password: string };
type Verify2FAPayload = { code: string };

type DecodedToken = {
  sub?: string;
  email?: string;
  permissions?: string[]; // PBAC permissions
  roles?: string[]; // optional roles
  exp?: number;
  iat?: number;
  [key: string]: any;
};

type User = {
  id?: string;
  email?: string;
  name?: string;
  // add any additional user fields your backend returns
  [key: string]: any;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  requires2FA: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
  refreshToken: () => Promise<void>;
};

const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token'; // optional if you use refresh tokens

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Helper: safeApi - modular error handling wrapper
 * returns { data } on success or throws an Error with friendly message
 */
async function safeApi<T>(promise: Promise<any>): Promise<T> {
  try {
    const res = await promise;
    return res.data as T;
  } catch (err: any) {
    // Normalize error message for thrown Error
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'An unexpected error occurred';
    throw new Error(msg);
  }
}

/**
 * Decode token helper - returns parsed token or null
 */
function decodeToken(token?: string | null): DecodedToken | null {
  if (!token) return null;
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    // attempt to prefill user from token if payload contains user info
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) return null;
    const decoded = decodeToken(saved);
    if (!decoded) return null;
    // if your token contains user claims, map them; adjust as needed
    return {
      id: decoded.sub,
      email: decoded.email,
      ...((decoded as any).user || {}),
    };
  });

  const [requires2FA, setRequires2FA] = useState<boolean>(false);

  // Attach token to axios defaults when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Setup response interceptor to auto-logout on 401
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (error) => {
        const status = error?.response?.status;
        if (status === 401) {
          // Token invalid or expired: logout and redirect to login
          clearAuthState();
          // Don't navigate directly here in the interceptor (prevents router issues),
          // but we can optionally force reload or set a flag. We'll navigate in the next tick.
          window.setTimeout(() => {
            // Only navigate if not already on login page
            if (!window.location.pathname.startsWith('/login')) {
              window.location.href = '/login';
            }
          }, 50);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAuthState() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // ignore localStorage errors
    }
    setToken(null);
    setUser(null);
    setRequires2FA(false);
    delete api.defaults.headers.common['Authorization'];
  }

  /**
   * login - calls backend, if backend signals requires2FA sets flag and returns,
   * otherwise persists token & user to context and localStorage.
   */
  const login = async ({ email, password }: LoginPayload): Promise<void> => {
    // call api
    const data = await safeApi<any>(api.post('/auth/login', { email, password }));

    // Example backend responses you might get:
    // 1) { requires2FA: true }
    // 2) { token: '...', user: { ... } }
    // 3) { accessToken: '...', refreshToken: '...', user: {...} }

    if (data?.requires2FA) {
      setRequires2FA(true);
      return;
    }

    // support both token and accessToken naming
    const resolvedToken = data?.token || data?.accessToken || null;
    const refreshToken = data?.refreshToken || null;
    const returnedUser = data?.user || data?.profile || null;

    if (!resolvedToken) {
      // Defensive: if backend didn't return a token, treat as failure
      throw new Error('Authentication failed: no token returned from server.');
    }

    // Persist tokens
    try {
      localStorage.setItem(TOKEN_KEY, resolvedToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // ignore localStorage errors but still set in-memory
    }

    // Set axios header & context state
    api.defaults.headers.common['Authorization'] = `Bearer ${resolvedToken}`;
    setToken(resolvedToken);

    // If user object is missing, try to decode from token
    if (returnedUser) {
      setUser(returnedUser);
    } else {
      const decoded = decodeToken(resolvedToken);
      const inferredUser: User = {
        id: decoded?.sub,
        email: decoded?.email,
        ...(decoded?.user || {}),
      };
      setUser(inferredUser);
    }

    setRequires2FA(false);
  };

  /**
   * verify2FA - verify code endpoint, expects token+user on success
   */
  const verify2FA = async (codeOrPayload: string | Verify2FAPayload): Promise<void> => {
    const payload = typeof codeOrPayload === 'string' ? { code: codeOrPayload } : codeOrPayload;
    const data = await safeApi<any>(api.post('/auth/verify-2fa', payload));

    const resolvedToken = data?.token || data?.accessToken || null;
    const refreshToken = data?.refreshToken || null;
    const returnedUser = data?.user || null;

    if (!resolvedToken) {
      throw new Error('2FA verification failed: no token returned.');
    }

    try {
      localStorage.setItem(TOKEN_KEY, resolvedToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // ignore
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${resolvedToken}`;
    setToken(resolvedToken);

    if (returnedUser) {
      setUser(returnedUser);
    } else {
      const decoded = decodeToken(resolvedToken);
      const inferredUser: User = {
        id: decoded?.sub,
        email: decoded?.email,
        ...(decoded?.user || {}),
      };
      setUser(inferredUser);
    }

    setRequires2FA(false);
  };

  /**
   * refreshToken - if you store refresh token, call backend to get fresh access token
   */
  const refreshToken = async (): Promise<void> => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefresh) {
      clearAuthState();
      return;
    }
    const data = await safeApi<any>(api.post('/auth/refresh', { refreshToken: storedRefresh }));
    const resolvedToken = data?.token || data?.accessToken;
    const refreshTokenNew = data?.refreshToken || null;
    if (!resolvedToken) {
      clearAuthState();
      return;
    }
    try {
      localStorage.setItem(TOKEN_KEY, resolvedToken);
      if (refreshTokenNew) localStorage.setItem(REFRESH_TOKEN_KEY, refreshTokenNew);
    } catch {
      // ignore
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${resolvedToken}`;
    setToken(resolvedToken);
    const decoded = decodeToken(resolvedToken);
    setUser({
      id: decoded?.sub,
      email: decoded?.email,
      ...(decoded?.user || {}),
    });
    setRequires2FA(false);
  };

  /**
   * logout - clear all auth state
   */
  const logout = () => {
    // Optional: hit backend logout endpoint (revoke refresh token)
    // fire-and-forget; we don't block logout on network success
    try {
      api.post('/auth/logout').catch(() => null);
    } catch {
      // no-op
    }
    clearAuthState();
    // navigate to login explicitly
    navigate('/login');
  };

  /**
   * hasPermission - PBAC helper: check if decoded token contains a permission
   */
  const hasPermission = (perm: string): boolean => {
    if (!token) return false;
    const decoded = decodeToken(token);
    const perms: string[] = (decoded?.permissions as string[]) || (decoded?.scopes as string[]) || [];
    return perms.includes(perm);
  };

  // On mount, try refresh if token is expired or missing but refresh token exists
  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        // attempt refresh if refresh token exists
        const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (refresh) {
          try {
            await refreshToken();
          } catch {
            clearAuthState();
          }
        }
        return;
      }
      const decoded = decodeToken(token);
      if (decoded?.exp && Date.now() >= decoded.exp * 1000) {
        // token expired; try refresh
        try {
          await refreshToken();
        } catch {
          clearAuthState();
        }
      }
    };

    checkToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextType = {
    user,
    token,
    requires2FA,
    login,
    verify2FA,
    logout,
    hasPermission,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;