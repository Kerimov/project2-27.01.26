import { apiJson } from './client';

export async function diaryWeeklyReview(params?: { from?: string; to?: string; patientId?: string }) {
  return apiJson<{ review?: string; summary?: string; text?: string }>('/api/ai/diary-weekly-review', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

export async function diaryIndicatorLink(params: {
  indicatorName: string;
  from?: string;
  to?: string;
  patientId?: string;
}) {
  return apiJson<{ summary?: string; text?: string; links?: unknown[] }>('/api/ai/diary-indicator-link', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
