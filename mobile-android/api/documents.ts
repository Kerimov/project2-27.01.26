import { apiJson, API_BASE_URL, setAuthToken } from './client';

export type DocumentCategory =
  | 'blood_test'
  | 'urine_test'
  | 'imaging'
  | 'prescription'
  | 'medical_report'
  | 'vaccination'
  | 'other';

export interface DocumentSummary {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  parsed: boolean;
  studyType?: string;
  studyDate?: string;
  ocrConfidence?: number;
  category?: DocumentCategory;
}

export interface MedicalIndicator {
  name: string;
  value: string | number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  isNormal?: boolean;
}

export interface DocumentDetail {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadDate: string;
  parsed: boolean;
  studyDate?: string;
  studyType?: string;
  laboratory?: string;
  doctor?: string;
  findings?: string;
  rawText?: string;
  ocrConfidence?: number;
  tags?: string[];
  category?: DocumentCategory;
  notes?: string;
  indicators?: MedicalIndicator[];
}

export interface DocumentsResponse {
  documents: DocumentSummary[];
}

export interface DocumentResponse {
  document: DocumentDetail;
}

export interface UploadDocumentResponse {
  message: string;
  document: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadDate: string;
  };
}

export async function getDocuments(): Promise<DocumentSummary[]> {
  const res = await apiJson<DocumentsResponse>('/api/documents');
  return res.documents;
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const res = await apiJson<DocumentResponse>(`/api/documents/${id}`);
  return res.document;
}

export async function uploadDocument(
  fileUri: string,
  fileName: string,
  mimeType: string,
  token: string | null
): Promise<UploadDocumentResponse> {
  // В React Native FormData работает с объектами { uri, name, type }
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  // Отправляем запрос
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  // Не устанавливаем Content-Type - React Native сам установит с boundary для FormData

  const res = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers,
    body: formData as any,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return await res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  await apiJson(`/api/documents/${id}`, { method: 'DELETE' });
}

export async function reprocessDocument(id: string): Promise<DocumentSummary | null> {
  const res = await apiJson<{ document: DocumentSummary | null }>(`/api/documents/${id}/process`, {
    method: 'POST',
    timeoutMs: 180000,
  });
  return res.document;
}

export async function reviewDocument(
  id: string,
  patch: {
    studyType?: string;
    studyDate?: string;
    laboratory?: string;
    doctor?: string;
    findings?: string;
    rawText?: string;
    indicators?: MedicalIndicator[];
  }
): Promise<DocumentDetail> {
  const res = await apiJson<DocumentResponse>(`/api/documents/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ patch }),
  });
  return res.document;
}
