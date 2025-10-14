import 'reflect-metadata';
import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';
import { ILicense, IActivation } from '../types/models';

const ActivationSchema = new Schema<IActivation>(
  {
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    active: {
      type: Boolean,
      default: true,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { _id: false }
);

const LicenseSchema = new Schema<ILicense>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    pluginId: {
      type: String,
      required: true,
      ref: 'Plugin',
      index: true,
    },
    pluginSlug: {
      type: String,
      required: true,
      index: true,
    },
    
    // License details
    type: {
      type: String,
      enum: ['single', 'developer', 'unlimited'],
      default: 'single',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'suspended', 'cancelled'],
      default: 'active',
      index: true,
    },
    
    // Activation
    activationsLimit: {
      type: Number,
      default: 1,
    },
    activationsCount: {
      type: Number,
      default: 0,
    },
    activations: {
      type: [ActivationSchema],
      default: [],
    },
    
    // Dates
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    lastCheckedAt: {
      type: Date,
    },
    
    // Payment
    orderId: {
      type: String,
    },
    amount: {
      type: Number,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
    },
    
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
LicenseSchema.index({ key: 1 });
LicenseSchema.index({ userId: 1, status: 1 });
LicenseSchema.index({ pluginSlug: 1, status: 1 });
LicenseSchema.index({ expiresAt: 1 });
LicenseSchema.index({ createdAt: -1 });

// Generate unique license key
LicenseSchema.statics.generateLicenseKey = function (): string {
  const segments = 4;
  const segmentLength = 4;
  const key: string[] = [];
  
  for (let i = 0; i < segments; i++) {
    const segment = crypto
      .randomBytes(segmentLength)
      .toString('hex')
      .toUpperCase()
      .slice(0, segmentLength);
    key.push(segment);
  }
  
  return key.join('-');
};

// Check if license is valid
LicenseSchema.methods.isValid = function (): boolean {
  if (this.status !== 'active') return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

// Check if can activate on new domain
LicenseSchema.methods.canActivate = function (domain: string): boolean {
  if (!this.isValid()) return false;
  
  // Check if already activated on this domain
  const existingActivation = this.activations.find(
    (a: IActivation) => a.domain === domain && a.active
  );
  if (existingActivation) return true;
  
  // Check if reached activation limit
  const activeActivations = this.activations.filter(
    (a: IActivation) => a.active
  ).length;
  
  return activeActivations < this.activationsLimit;
};

export default mongoose.model<ILicense>('License', LicenseSchema);
