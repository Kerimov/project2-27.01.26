import { apiJson } from './client';

export type AnalysisStatus = 'normal' | 'warning' | 'critical' | string;

export interface AnalysisSummary {
  id: string;
  title: string;
  type: string | null;
  date: string; // ISO
  status: AnalysisStatus | null;
  laboratory: string | null;
  documentId?: string | null;
}

export interface AnalysisResultItem {
  name: string;
  value: number | string;
  unit?: string | null;
  reference?: string | null;
  flag?: 'low' | 'high' | 'normal' | string;
}

export interface AnalysisDetail extends AnalysisSummary {
  doctor: string | null;
  notes: string | null;
  results: AnalysisResultItem[]; // JSON-поле results
  normalRange?: string | null;
}

type ListResponse = { analyses: AnalysisDetail[] };
type DetailResponse = { analysis: AnalysisDetail };

export async function getAnalyses(documentId?: string): Promise<AnalysisSummary[]> {
  const url = documentId ? `/api/analyses?documentId=${documentId}` : '/api/analyses';
  const data = await apiJson<ListResponse>(url);
  return data.analyses.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    date: a.date,
    status: (a.status as AnalysisStatus) ?? 'normal',
    laboratory: a.laboratory,
    documentId: a.documentId,
  }));
}

function normalizeResultsField(results: unknown): AnalysisDetail['results'] {
  if (typeof results === 'string') {
    try {
      return JSON.parse(results) as AnalysisDetail['results'];
    } catch {
      return [] as AnalysisResultItem[];
    }
  }
  return results as AnalysisDetail['results'];
}

export async function getAnalysis(id: string): Promise<AnalysisDetail> {
  const data = await apiJson<DetailResponse>(`/api/analyses/${id}`);
  return {
    ...data.analysis,
    results: normalizeResultsField(data.analysis.results),
  };
}

export async function createAnalysis(payload: {
  title: string;
  type: string;
  date: string;
  results: Record<string, { value: string | number; unit?: string; normal?: boolean }>;
  laboratory?: string;
  doctor?: string;
  normalRange?: string;
  status?: string;
  notes?: string;
}): Promise<AnalysisDetail> {
  const data = await apiJson<{ analysis: AnalysisDetail }>('/api/analyses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.analysis;
}

export async function deleteAnalysis(id: string): Promise<void> {
  await apiJson(`/api/analyses/${id}`, { method: 'DELETE' });
}

