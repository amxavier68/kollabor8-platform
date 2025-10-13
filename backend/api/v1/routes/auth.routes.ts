import express, { Router } from 'express';

const router: Router = express.Router();

// Placeholder routes
router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - coming soon' });
});

router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint - coming soon' });
});

export default router;