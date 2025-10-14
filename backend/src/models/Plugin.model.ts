import 'reflect-metadata';
import mongoose, { Schema } from 'mongoose';
import { IPlugin, IChangelog } from '../types/models';

const ChangelogSchema = new Schema<IChangelog>(
  {
    version: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    changes: {
      type: [String],
      required: true,
    },
    type: {
      type: String,
      enum: ['major', 'minor', 'patch'],
      default: 'patch',
    },
  },
  { _id: false }
);

const PluginSchema = new Schema<IPlugin>(
  {
    name: {
      type: String,
      required: [true, 'Plugin name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Plugin slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    
    // Version
    version: {
      type: String,
      required: true,
      match: [/^\d+\.\d+\.\d+$/, 'Version must be in format X.Y.Z'],
    },
    changelog: {
      type: [ChangelogSchema],
      default: [],
    },
    
    // Requirements
    requiresWordPress: {
      type: String,
      default: '5.0',
    },
    requiresPHP: {
      type: String,
      default: '7.4',
    },
    testedUpTo: {
      type: String,
      default: '6.4',
    },
    
    // Pricing
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    
    // Features
    features: {
      type: [String],
      default: [],
    },
    
    // Media
    thumbnail: String,
    screenshots: [String],
    banner: String,
    icon: String,
    
    // Downloads
    downloadUrl: {
      type: String,
      required: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    
    // Status
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    
    // SEO
    shortDescription: String,
    tags: [String],
    category: String,
    
    // Demo
    demoUrl: String,
    documentationUrl: String,
    
    // Ratings
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    ratingsCount: {
      type: Number,
      default: 0,
    },
    
    // Metadata
    metadata: Schema.Types.Mixed,
    
    // Soft delete
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
PluginSchema.index({ slug: 1 });
PluginSchema.index({ status: 1, createdAt: -1 });
PluginSchema.index({ tags: 1 });
PluginSchema.index({ category: 1 });

export default mongoose.model<IPlugin>('Plugin', PluginSchema);
