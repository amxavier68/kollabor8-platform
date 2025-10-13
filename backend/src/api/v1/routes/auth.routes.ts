import express, { Router } from 'express';

const router: Router = express.Router();

router.post('/login', (_req, res) => {
  res.json({ success: true, message: 'Login endpoint - coming soon' });
});

router.post('/register', (_req, res) => {
  res.json({ success: true, message: 'Register endpoint - coming soon' });
});

export default router;
