import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';

class ApiService {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/${API_VERSION}`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            if (!this.refreshPromise) {
              this.refreshPromise = this.refreshAccessToken();
            }
            const newToken = await this.refreshPromise;
            this.refreshPromise = null;
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.refreshPromise = null;
            this.clearTokens();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');
    try {
      const response = await axios.post(`${API_URL}/api/${API_VERSION}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      this.setTokens(accessToken, newRefreshToken);
      return accessToken;
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  private normalizeError(error: AxiosError<ApiError>): ApiError {
    if (error.response?.data) return error.response.data;
    if (error.request) return { message: 'Network error.', code: 'NETWORK_ERROR' };
    return { message: error.message || 'Error occurred', code: 'UNKNOWN_ERROR' };
  }

  private setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async get<T>(url: string, config = {}) {
    return this.client.get<T>(url, config);
  }

  async post<T>(url: string, data?: any, config = {}) {
    return this.client.post<T>(url, data, config);
  }

  async put<T>(url: string, data?: any, config = {}) {
    return this.client.put<T>(url, data, config);
  }

  async patch<T>(url: string, data?: any, config = {}) {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T>(url: string, config = {}) {
    return this.client.delete<T>(url, config);
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export const api = new ApiService();
