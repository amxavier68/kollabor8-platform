export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface License {
  id: string;
  key: string;
  plugin_slug: string;
  plugin_name: string;
  status: 'active' | 'expired' | 'suspended';
  expires_at?: string;
  activations_limit: number;
  activations_count: number;
  created_at: string;
}

export interface Plugin {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  price: number;
  features: string[];
  thumbnail?: string;
  demo_url?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}
