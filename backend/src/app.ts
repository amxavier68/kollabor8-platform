import 'reflect-metadata';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { apiVersions, defaultVersion, deprecationConfig } from './config/api-versions';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined'));

// API version deprecation middleware
app.use('/api/:version', (req: Request, res: Response, next: NextFunction) => {
  const version = req.params.version;
  const versionConfig = apiVersions[version];

  if (!versionConfig) {
    res.status(404).json({
      success: false,
      error: 'API version not found',
      data: {
        availableVersions: Object.keys(apiVersions)
      }
    } as ApiResponse);
    return;
  }

  if (versionConfig.deprecated && deprecationConfig.headers) {
    const daysUntilSunset = versionConfig.sunsetDate
      ? Math.ceil((new Date(versionConfig.sunsetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    res.set({
      'X-API-Deprecated': 'true',
      'X-API-Sunset-Date': versionConfig.sunsetDate || 'TBD',
      'X-API-Days-Until-Sunset': daysUntilSunset?.toString() || 'unknown',
      'X-API-Migration-Guide': `https://docs.kollabor8.com/migration/${version}`
    });
  }

  req.apiVersion = version;
  next();
});

// Version routes
import v1Routes from './api/v1/routes';
import v2Routes from './api/v2/routes';

app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// Default version redirect
app.use('/api', (req: Request, res: Response) => {
  res.redirect(`/api/${defaultVersion}${req.url}`);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    versions: apiVersions
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  } as ApiResponse);
});

// Error handler
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  } as ApiResponse);
});

export default app;
