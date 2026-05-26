import { apiJson } from './client';

export type AnalysisTrendResult = {
  indicatorName?: string;
  interpretation?: string;
  summary?: string;
  text?: string;
  result?: {
    tldr?: string;
    whatChanged?: string[];
    nextSteps?: string[];
    confidence?: number;
  };
};

type TrendSeriesPoint = {
  date: string;
  value: number;
  unit?: string;
  isNormal?: boolean | null;
  title?: string;
};

export async function fetchAnalysisTrend(analysisId: string, indicatorName?: string) {
  return fetchAnalysisTrendComparison({ analysisId, indicatorName: indicatorName || '' });
}

export async function fetchAnalysisTrendComparison(params: {
  analysisId?: string;
  analysisIds?: string[];
  indicatorName: string;
  series?: TrendSeriesPoint[];
}) {
  return apiJson<AnalysisTrendResult>('/api/ai/analysis-trend', {
    method: 'POST',
    body: JSON.stringify(params),
    timeoutMs: 120000,
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
