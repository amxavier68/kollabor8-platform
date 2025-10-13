import express, { Router } from 'express';
// import licenseController from '../controllers/license.controller';

const router: Router = express.Router();

// Placeholder routes
router.post('/validate', (req, res) => {
  res.json({ message: 'License validation - coming soon' });
});

router.get('/', (req, res) => {
  res.json({ message: 'Get licenses - coming soon' });
});

export default router;