import { apiJson } from './client';

export type AIMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachedDocuments?: Array<{
    id: string;
    fileName: string;
    studyType?: string;
  }>;
  functionResult?: any;
  functionName?: string;
  sources?: Array<{
    sourceType?: 'document' | 'analysis' | 'diary' | 'knowledge';
    id?: string;
    label?: string;
    date?: string | null;
    url?: string | null;
    snippet?: string;
  }>;
};

export type AIChatRequest = {
  message: string;
  history?: AIMessage[];
  documentIds?: string[];
  ragScope?: 'none' | 'attached' | 'all';
};

export type AIChatResponse = {
  response: string;
  functionResult?: any;
  functionName?: string;
  sources?: Array<{
    sourceType?: 'document' | 'analysis' | 'diary' | 'knowledge';
    id?: string;
    label?: string;
    date?: string | null;
    url?: string | null;
    snippet?: string;
  }>;
  timestamp: string;
};

/**
 * Отправка сообщения в AI ассистент
 */
export async function sendAIMessage(request: AIChatRequest): Promise<AIChatResponse> {
  return apiJson<AIChatResponse>('/api/ai/assistant', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
