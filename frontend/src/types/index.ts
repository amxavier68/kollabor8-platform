// frontend/src/types/index.ts

// ============================================================================
// Auth Types
// ============================================================================

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: UserProfile;
  requires2FA?: boolean;
  tempToken?: string;
  message?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

// ============================================================================
// 2FA Types
// ============================================================================

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerifyRequest {
  token: string;
  code: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'developer' | 'admin';
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// License Types
// ============================================================================

export interface License {
  id: string;
  licenseKey: string;
  productId: string;
  userId: string;
  status: 'active' | 'inactive' | 'expired' | 'suspended';
  type: 'single' | 'multiple' | 'unlimited';
  maxActivations: number;
  currentActivations: number;
  expiresAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseActivation {
  id: string;
  domain: string;
  ipAddress: string;
  activatedAt: string;
  lastCheckedAt: string;
  isActive: boolean;
}

export interface CreateLicenseRequest {
  productId: string;
  userId?: string;
  type: 'single' | 'multiple' | 'unlimited';
  maxActivations?: number;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface ValidateLicenseRequest {
  licenseKey: string;
  domain: string;
}

export interface ValidateLicenseResponse {
  valid: boolean;
  license?: License;
  message?: string;
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface Plugin {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloadUrl: string;
  iconUrl?: string;
  bannerUrl?: string;
  tags: string[];
  requiresWP: string;
  requiresPHP: string;
  testedUpTo: string;
  changelog: PluginVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginVersion {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  changelog: string;
}

export interface CreatePluginRequest {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloadUrl: string;
  iconUrl?: string;
  bannerUrl?: string;
  tags?: string[];
  requiresWP?: string;
  requiresPHP?: string;
  testedUpTo?: string;
}

export interface UpdatePluginRequest {
  name?: string;
  description?: string;
  version?: string;
  downloadUrl?: string;
  iconUrl?: string;
  bannerUrl?: string;
  tags?: string[];
  requiresWP?: string;
  requiresPHP?: string;
  testedUpTo?: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsEvent {
  id: string;
  eventType: string;
  userId?: string;
  licenseId?: string;
  pluginId?: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface DashboardStats {
  totalLicenses: number;
  activeLicenses: number;
  totalPlugins: number;
  totalActivations: number;
  recentActivity: AnalyticsEvent[];
}

export interface OperationsTimelineItem {
  type: 'event' | 'work_item' | 'approval' | 'evidence';
  at: string;
  record: Record<string, any>;
}

export interface OperationsTransaction {
  correlation_id: string;
  current_state: string | null;
  current_event_id: string | null;
  open_work_items: number;
  counts: {
    events: number;
    work_items: number;
    approvals: number;
    evidence: number;
  };
  events: Record<string, any>[];
  work_items: Record<string, any>[];
  approvals: Record<string, any>[];
  evidence: Record<string, any>[];
  timeline: OperationsTimelineItem[];
}

export interface OperationsTransactionResponse {
  transaction: OperationsTransaction;
}

export interface OperationsInterventionRequest {
  reason: string;
  requested_action: string;
  customer_impact?: string;
  approval_level?: 'A1' | 'A2' | 'A3';
}

export interface OperationsInterventionResponse {
  work_item: Record<string, any>;
}
