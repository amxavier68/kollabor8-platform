import express, { Router } from 'express';
import authRoutes from './auth.routes';
import licenseRoutes from './license.routes';

const router: Router = express.Router();

router.get('/', (_req, res) => {
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

router.use('/auth', authRoutes);
router.use('/licenses', licenseRoutes);

export default router;
