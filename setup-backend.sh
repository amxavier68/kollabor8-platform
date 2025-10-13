#!/bin/bash

cd ~/Desktop/PROJECTS/kollabor8-platform/backend/src

# Create v1 types
mkdir -p api/v1/types
cat > api/v1/types/index.ts << 'EOF'
export interface LicenseValidationRequest {
  license_key: string;
  domain: string;
  plugin_slug: string;
  plugin_version: string;
}

export interface LicenseValidationResponse {
  valid: boolean;
  license: {
    key: string;
    status: 'active' | 'expired' | 'suspended';
    expires_at?: string;
  };
}
EOF

# Create v2 structure
mkdir -p api/v2/{controllers,middleware,routes,types}
cat > api/v2/routes/index.ts << 'EOF'
import express, { Router } from 'express';

const router: Router = express.Router();

router.get('/', (req, res) => {
  res.json({
    version: 'v2',
    status: 'beta',
    message: 'API v2 coming soon'
  });
});

export default router;
EOF

# Create shared folder
mkdir -p api/shared/{services,utils,config}

# Create root level folders
mkdir -p models services config types utils

# Create type definitions
cat > types/express.d.ts << 'EOF'
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        id: string;
        email: string;
        role: string;
      };
      apiVersion?: string;
    }
  }
}
EOF

cat > types/global.d.ts << 'EOF'
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
EOF

# Create config files
cat > config/api-versions.ts << 'EOF'
export const apiVersions = {
  v1: {
    status: 'stable',
    deprecated: false,
    sunsetDate: null,
    features: ['auth', 'licenses', 'plugins']
  },
  v2: {
    status: 'beta',
    deprecated: false,
    sunsetDate: null,
    features: ['auth', 'licenses', 'plugins', 'analytics']
  }
};

export const defaultVersion = 'v1';
EOF

cat > config/database.ts << 'EOF'
import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kollabor8_dev';
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};
EOF

cat > config/index.ts << 'EOF'
export * from './api-versions';
export * from './database';
EOF

# Create server.ts
cat > server.ts << 'EOF'
import app from './app';
import { connectDatabase } from './config';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 API v1: http://localhost:${PORT}/api/v1`);
      console.log(`📍 API v2: http://localhost:${PORT}/api/v2`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});
EOF

echo "✅ Backend structure created!"