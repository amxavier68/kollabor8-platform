import { Document } from 'mongoose';

export interface IBaseModel extends Document {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  isDeleted: boolean;
}

export interface IUser extends IBaseModel {
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin' | 'developer';
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  
  // 2FA
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  
  // Profile
  avatar?: string;
  company?: string;
  website?: string;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generatePasswordResetToken(): string;
  generateEmailVerificationToken(): string;
  isLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

export interface ILicense extends IBaseModel {
  key: string;
  userId: string;
  pluginId: string;
  pluginSlug: string;
  
  // License details
  type: 'single' | 'developer' | 'unlimited';
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  
  // Activation
  activationsLimit: number;
  activationsCount: number;
  activations: IActivation[];
  
  // Dates
  purchasedAt: Date;
  expiresAt?: Date;
  lastCheckedAt?: Date;
  
  // Payment
  orderId?: string;
  amount?: number;
  currency?: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface IActivation {
  domain: string;
  activatedAt: Date;
  lastSeenAt: Date;
  active: boolean;
  ip?: string;
  userAgent?: string;
}

export interface IPlugin extends IBaseModel {
  name: string;
  slug: string;
  description: string;
  
  // Version
  version: string;
  changelog: IChangelog[];
  
  // Requirements
  requiresWordPress: string;
  requiresPHP: string;
  testedUpTo: string;
  
  // Pricing
  price: number;
  currency: string;
  
  // Features
  features: string[];
  
  // Media
  thumbnail?: string;
  screenshots?: string[];
  banner?: string;
  icon?: string;
  
  // Downloads
  downloadUrl: string;
  downloadCount: number;
  
  // Status
  status: 'draft' | 'published' | 'archived';
  
  // SEO
  shortDescription?: string;
  tags?: string[];
  category?: string;
  
  // Demo
  demoUrl?: string;
  documentationUrl?: string;
  
  // Ratings
  rating?: number;
  ratingsCount?: number;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface IChangelog {
  version: string;
  date: Date;
  changes: string[];
  type: 'major' | 'minor' | 'patch';
}

export interface IRefreshToken extends IBaseModel {
  userId: string;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  replacedByToken?: string;
  userAgent?: string;
  ip?: string;
}

export interface IAnalyticsEvent extends IBaseModel {
  userId?: string;
  eventType: string;
  eventData: Record<string, any>;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
}
