import { api } from './api.service';
import type {
  OperationsInterventionRequest,
  OperationsInterventionResponse,
  OperationsTransactionResponse,
} from '../types';

class OperationsService {
  async getTransaction(correlationId: string) {
    const response = await api.get<OperationsTransactionResponse>(
      `/operations/transactions/${encodeURIComponent(correlationId)}`
    );
    return response.data.transaction;
  }

  async createIntervention(correlationId: string, data: OperationsInterventionRequest) {
    const response = await api.post<OperationsInterventionResponse>(
      `/operations/transactions/${encodeURIComponent(correlationId)}/interventions`,
      data
    );
    return response.data.work_item;
  }
}

export const operationsService = new OperationsService();
