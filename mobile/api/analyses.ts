import { apiJson } from './client';

export type AnalysisStatus = 'normal' | 'warning' | 'critical' | string;

export interface AnalysisSummary {
  id: string;
  title: string;
  type: string | null;
  date: string; // ISO
  status: AnalysisStatus | null;
  laboratory: string | null;
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

export async function getAnalyses(): Promise<AnalysisSummary[]> {
  const data = await apiJson<ListResponse>('/api/analyses');
  return data.analyses.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    date: a.date,
    status: (a.status as AnalysisStatus) ?? 'normal',
    laboratory: a.laboratory,
  }));
}

export async function getAnalysis(id: string): Promise<AnalysisDetail> {
  const data = await apiJson<DetailResponse>(`/api/analyses/${id}`);
  // results уже JSON.parse на бэке
  return data.analysis;
}

