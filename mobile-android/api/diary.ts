import { apiJson } from './client';

export interface DiaryTag {
  id: string;
  name: string;
  color?: string | null;
}

export interface DiaryEntry {
  id: string;
  userId: string;
  entryDate: string; // ISO date
  mood?: number | null; // 1-5
  painScore?: number | null; // 0-10
  sleepHours?: number | null;
  steps?: number | null;
  temperature?: number | null;
  weight?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  symptoms?: string | null;
  notes?: string | null;
  tags: { tag: DiaryTag }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiaryEntryData {
  entryDate?: string; // ISO date
  mood?: number;
  painScore?: number;
  sleepHours?: number;
  steps?: number;
  temperature?: number;
  weight?: number;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  symptoms?: string;
  notes?: string;
  tags?: string[];
  patientId?: string;
}

export interface UpdateDiaryEntryData {
  entryDate?: string;
  mood?: number | null;
  painScore?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  temperature?: number | null;
  weight?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  symptoms?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface GetDiaryEntriesParams {
  patientId?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  tag?: string;
  order?: 'asc' | 'desc';
}

export async function getDiaryEntries(
  params?: GetDiaryEntriesParams
): Promise<DiaryEntry[]> {
  const searchParams = new URLSearchParams();
  if (params?.patientId) searchParams.set('patientId', params.patientId);
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.order) searchParams.set('order', params.order);

  const url = `/api/diary/entries${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const data = await apiJson<DiaryEntry[]>(url);
  return Array.isArray(data) ? data : [];
}

export async function createDiaryEntry(
  entryData: CreateDiaryEntryData
): Promise<DiaryEntry> {
  const data = await apiJson<DiaryEntry>('/api/diary/entries', {
    method: 'POST',
    body: JSON.stringify(entryData),
  });
  return data;
}

export async function updateDiaryEntry(
  id: string,
  entryData: UpdateDiaryEntryData
): Promise<DiaryEntry> {
  const data = await apiJson<DiaryEntry>(`/api/diary/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entryData),
  });
  return data;
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  await apiJson(`/api/diary/entries/${id}`, { method: 'DELETE' });
}
