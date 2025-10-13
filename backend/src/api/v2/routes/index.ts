import express, { Router } from 'express';

const router: Router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    version: 'v2',
    status: 'beta',
    message: 'API v2 coming soon'
  });
});

export default router;
