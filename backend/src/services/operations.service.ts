import axios from 'axios';

const platformUrl = process.env.K8_PLATFORM_URL;
const platformKey = process.env.K8_API_KEY;

function client() {
  if (!platformUrl || !platformKey) {
    throw new Error('K8 Platform connection is not configured');
  }
  return axios.create({
    baseURL: platformUrl,
    headers: {
      'Content-Type': 'application/json',
      'x-k8-api-key': platformKey,
    },
    timeout: 15000,
  });
}

export class OperationsService {
  async getTransaction(correlationId: string) {
    const response = await client().get(`/api/v1/operations/transactions/${encodeURIComponent(correlationId)}`);
    return response.data;
  }

  async createIntervention(correlationId: string, data: unknown) {
    const response = await client().post(
      `/api/v1/operations/transactions/${encodeURIComponent(correlationId)}/interventions`,
      data
    );
    return response.data;
  }
}
