import 'reflect-metadata';
import mongoose, { Schema } from 'mongoose';
import { IAnalyticsEvent } from '../types/models';

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    userId: {
      type: String,
      ref: 'User',
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    eventData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    ip: String,
    userAgent: String,
    sessionId: {
      type: String,
      index: true,
    },
    
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

// Indexes
AnalyticsEventSchema.index({ eventType: 1, createdAt: -1 });
AnalyticsEventSchema.index({ userId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ createdAt: -1 });

export default mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);
