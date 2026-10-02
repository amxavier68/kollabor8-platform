import { Request, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth.middleware';
import { OperationsService } from '../../../services/operations.service';

const operations = new OperationsService();

function statusFrom(error: unknown): number {
  return axios.isAxiosError(error) ? (error.response?.status ?? 502) : 500;
}

function payloadFrom(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data ?? { error: 'platform_unavailable' };
  return { error: 'operations_error' };
}

export class OperationsController {
  async getTransaction(req: Request, res: Response): Promise<void> {
    try {
      const result = await operations.getTransaction(req.params.correlationId);
      res.json(result);
    } catch (error) {
      res.status(statusFrom(error)).json(payloadFrom(error));
    }
  }

  async createIntervention(req: Request, res: Response): Promise<void> {
    try {
      const operator = (req as AuthRequest).user!;
      const body = {
        ...req.body,
        actor: { type: 'human', id: operator.id },
      };
      const result = await operations.createIntervention(req.params.correlationId, body);
      res.status(201).json(result);
    } catch (error) {
      res.status(statusFrom(error)).json(payloadFrom(error));
    }
  }
}

export const operationsController = new OperationsController();
