// frontend/src/services/auth.service.ts
import { api } from './api.service';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TwoFactorSetupResponse,
  TwoFactorVerifyRequest,
  UserProfile
} from '../types';

class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response.data;
  }

  /**
   * Login user (may return 2FA required)
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);
    
    // Store tokens if login successful (no 2FA required)
    if (response.data.accessToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    
    return response.data;
  }

  /**
   * Verify 2FA code after login
   */
  async verify2FA(data: TwoFactorVerifyRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/2fa/verify', data);
    
    if (response.data.accessToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    
    return response.data;
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post<RefreshTokenResponse>('/auth/refresh', {
      refreshToken
    });

    this.setTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    const response = await api.get<UserProfile>('/auth/me');
    return response.data;
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.post('/auth/change-password', data);
  }

  /**
   * Request password reset
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    await api.post('/auth/forgot-password', data);
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    await api.post('/auth/reset-password', data);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    await api.get(`/auth/verify-email/${token}`);
  }

  /**
   * Setup 2FA for user account
   */
  async setup2FA(): Promise<TwoFactorSetupResponse> {
    const response = await api.post<TwoFactorSetupResponse>('/auth/2fa/setup');
    return response.data;
  }

  /**
   * Disable 2FA for user account
   */
  async disable2FA(password: string): Promise<void> {
    await api.post('/auth/2fa/disable', { password });
  }

  // Token management helpers
  private setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

export const authService = new AuthService();