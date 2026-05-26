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
  provider?: string;
  requestId?: string;
  sources?: Array<{
    sourceType?: 'document' | 'analysis' | 'diary' | 'knowledge' | 'app' | 'marketplace';
    id?: string;
    label?: string;
    date?: string | null;
    url?: string | null;
    snippet?: string;
  }>;
};

export type AssistantAction =
  | { type: 'select_doctor'; doctorId: string; date?: string | null }
  | { type: 'select_slot'; doctorId: string; scheduledAt: string }
  | { type: 'confirm_booking' }
  | { type: 'cancel_booking' }
  | { type: 'complete_task'; taskId: string };

export type PendingBooking = {
  doctorId: string;
  doctorName: string;
  specialization?: string | null;
  scheduledAt: string;
  timeString: string;
  appointmentType: string;
  notes?: string | null;
};

export type AIChatRequest = {
  message: string;
  history?: AIMessage[];
  documentIds?: string[];
  ragScope?: 'none' | 'attached' | 'patient_data' | 'app_knowledge' | 'marketplace' | 'all';
  action?: AssistantAction;
  pendingBooking?: PendingBooking | null;
};

export type AIChatResponse = {
  response: string;
  functionResult?: any;
  functionName?: string;
  provider?: string;
  requestId?: string;
  sources?: Array<{
    sourceType?: 'document' | 'analysis' | 'diary' | 'knowledge' | 'app' | 'marketplace';
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
