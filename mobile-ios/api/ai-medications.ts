import { apiJson } from './client';

export async function generateMedicationPlan(patientId?: string) {
  return apiJson<{ tldr?: string; schedule?: unknown[]; reminders?: unknown[]; message?: string }>(
    '/api/ai/medications/plan',
    {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    }
  );
}
