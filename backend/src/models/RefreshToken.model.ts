import 'reflect-metadata';
import mongoose, { Schema } from 'mongoose';
import { IRefreshToken } from '../types/models';

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: Date,
    replacedByToken: String,
    userAgent: String,
    ip: String,
    
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Index for cleanup
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Check if token is valid
RefreshTokenSchema.methods.isValid = function (): boolean {
  return !this.isRevoked && this.expiresAt > new Date();
};

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
