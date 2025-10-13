import express, { Router } from 'express';

const router: Router = express.Router();

router.post('/validate', (_req, res) => {
  res.json({ success: true, message: 'License validation - coming soon' });
});

router.get('/', (_req, res) => {
  res.json({ success: true, data: [], message: 'Get licenses - coming soon' });
});

export default router;
