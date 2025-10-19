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
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response.data;
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);
    
    if (response.data.accessToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    
    return response.data;
  }

  async verify2FA(data: TwoFactorVerifyRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/2fa/verify', data);
    
    if (response.data.accessToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    
    return response.data;
  }

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

  async getProfile(): Promise<UserProfile> {
    const response = await api.get<UserProfile>('/auth/me');
    return response.data;
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.post('/auth/change-password', data);
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    await api.post('/auth/forgot-password', data);
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    await api.post('/auth/reset-password', data);
  }

  async verifyEmail(token: string): Promise<void> {
    await api.get(`/auth/verify-email/${token}`);
  }

  async setup2FA(): Promise<TwoFactorSetupResponse> {
    const response = await api.post<TwoFactorSetupResponse>('/auth/2fa/setup');
    return response.data;
  }

  async disable2FA(password: string): Promise<void> {
    await api.post('/auth/2fa/disable', { password });
  }

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
