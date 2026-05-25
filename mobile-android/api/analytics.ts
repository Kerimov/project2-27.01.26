import { apiJson } from './client';

export interface AnalyticsKPI {
  documentsCount?: number;
  analysesCount?: number;
  upcomingAppointments?: number;
  avgSleep?: number;
}

export interface TrendPoint {
  day: string;
  mood?: number;
  sleep?: number;
  steps?: number;
}

export interface AnalyticsData {
  kpi: AnalyticsKPI;
  trend: TrendPoint[];
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const data = await apiJson<AnalyticsData>('/api/analytics/me');
  return data;
}
