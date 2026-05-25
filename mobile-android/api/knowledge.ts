import { apiJson } from './client';

export interface ReferenceRange {
  id: string;
  methodology: { id: string; name: string; type: string; organization?: string };
  gender?: string;
  minValue?: number;
  maxValue?: number;
  note?: string;
}

export interface KnowledgeIndicator {
  id: string;
  name: string;
  nameEn?: string;
  shortName?: string;
  unit: string;
  description?: string;
  clinicalSignificance?: string;
  increasedMeaning?: string;
  decreasedMeaning?: string;
  referenceRanges: ReferenceRange[];
}

export interface StudyType {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  description?: string;
  clinicalSignificance?: string;
  indicators: KnowledgeIndicator[];
}

export async function getStudyTypes(): Promise<StudyType[]> {
  const data = await apiJson<StudyType[]>('/api/knowledge/study-types');
  return Array.isArray(data) ? data : [];
}
