import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { operationsController } from '../controllers/operations.controller';

const router = Router();

function requireOperator(req: Request, res: Response, next: NextFunction): void {
  const role = (req as AuthRequest).user?.role;
  if (!['admin', 'developer'].includes(role ?? '')) {
    res.status(403).json({ message: 'Operations Control access required' });
    return;
  }
  next();
}

router.use(authenticate, requireOperator);
router.get('/transactions/:correlationId', operationsController.getTransaction.bind(operationsController));
router.post('/transactions/:correlationId/interventions', operationsController.createIntervention.bind(operationsController));

export default router;
