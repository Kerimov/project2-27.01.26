import { apiJson } from './client';

export async function fetchAnalysisTrend(analysisId: string, indicatorName?: string) {
  return apiJson<{ interpretation?: string; summary?: string; text?: string }>('/api/ai/analysis-trend', {
    method: 'POST',
    body: JSON.stringify({ analysisId, indicatorName }),
  });
}

export type RiskTriageResult = {
  level?: 'ok' | 'attention' | 'urgent' | string;
  confidence?: number;
  summary?: string;
  reasons?: string[];
  redFlags?: string[];
  nextSteps?: string[];
};

export async function fetchRiskTriage(analysisId: string) {
  return apiJson<RiskTriageResult>('/api/ai/risk-triage', {
    method: 'POST',
    body: JSON.stringify({ analysisId, symptoms: '' }),
  });
}

export async function generateAnalysisComments(analysisId: string) {
  return apiJson<{ comment: string }>(`/api/analyses/${analysisId}/comments`, {
    method: 'POST',
  });
}

export async function generateCarePlanFromAnalysis(analysisId: string) {
  return apiJson<{ tasks?: unknown[]; message?: string }>('/api/ai/care-plan', {
    method: 'POST',
    body: JSON.stringify({ analysisId }),
  });
}
