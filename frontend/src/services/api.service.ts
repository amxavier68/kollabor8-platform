import 'reflect-metadata';
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '@types/index';
import { Log, Measure, Cache, Retry, Injectable } from '@decorators/index';

@Injectable()
class ApiService {
  private api: AxiosInstance;
  private apiVersion: string = 'v1';

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        // Check for API deprecation warnings
        const deprecated = response.headers['x-api-deprecated'];
        if (deprecated === 'true') {
          console.warn('⚠️ API Deprecation Warning:', {
            version: this.apiVersion,
            sunsetDate: response.headers['x-api-sunset-date'],
            daysLeft: response.headers['x-api-days-until-sunset'],
            migrationGuide: response.headers['x-api-migration-guide'],
          });
        }
        return response;
      },
      async (error: AxiosError<ApiResponse>) => {
        // Handle 401 errors
        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setApiVersion(version: string): void {
    this.apiVersion = version;
  }

  private getUrl(endpoint: string): string {
    return `/api/${this.apiVersion}${endpoint}`;
  }

  @Log
  @Measure
  @Retry(3, 1000)
  async get<T = any>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.api.get<ApiResponse<T>>(this.getUrl(endpoint), { params });
    return response.data;
  }

  @Log
  @Measure
  @Retry(3, 1000)
  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.post<ApiResponse<T>>(this.getUrl(endpoint), data);
    return response.data;
  }

  @Log
  @Measure
  @Retry(3, 1000)
  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.put<ApiResponse<T>>(this.getUrl(endpoint), data);
    return response.data;
  }

  @Log
  @Measure
  @Retry(3, 1000)
  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await this.api.delete<ApiResponse<T>>(this.getUrl(endpoint));
    return response.data;
  }

  @Cache(60000) // Cache for 1 minute
  async getHealthStatus(): Promise<ApiResponse> {
    const response = await this.api.get('/health');
    return response.data;
  }
}

export default new ApiService();
