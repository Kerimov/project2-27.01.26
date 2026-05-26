import { apiJson } from './client';

export async function generateMedicationPlan(patientId?: string) {
  const data = await apiJson<{
    result?: { tldr?: string; schedule?: unknown[]; reminders?: unknown[]; createdReminders?: unknown[]; message?: string };
    tldr?: string;
    schedule?: unknown[];
    reminders?: unknown[];
    createdReminders?: unknown[];
    message?: string;
  }>(
    '/api/ai/medications/plan',
    {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    }
  );
  const result = data.result || data;
  return {
    ...result,
    reminders: result.reminders || result.createdReminders || [],
  };
}
