import express, { Router } from 'express';

const router: Router = express.Router();

// Import route modules
import authRoutes from './auth.routes';
import licenseRoutes from './license.routes';
// import pluginRoutes from './plugin.routes';

// Version info endpoint
router.get('/', (req, res) => {
  res.json({
    version: 'v1',
    status: 'stable',
    endpoints: {
      auth: '/api/v1/auth',
      licenses: '/api/v1/licenses',
    },
    documentation: 'https://docs.kollabor8.com/api/v1'
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/licenses', licenseRoutes);
// router.use('/plugins', pluginRoutes);

export default router;