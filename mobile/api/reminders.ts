import { apiJson } from './client';

export type ReminderRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type ReminderChannel = 'EMAIL' | 'PUSH' | 'SMS';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  dueAt: string; // ISO date
  recurrence: ReminderRecurrence;
  channels: ReminderChannel[];
  analysisId?: string | null;
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
  analysis?: {
    id: string;
    title: string;
  } | null;
  document?: {
    id: string;
    fileName: string;
  } | null;
}

export async function getReminders(patientId?: string): Promise<Reminder[]> {
  const url = patientId ? `/api/reminders?patientId=${patientId}` : '/api/reminders';
  return await apiJson<Reminder[]>(url);
}

export async function createReminder(
  title: string,
  dueAt: string, // ISO date
  options?: {
    description?: string;
    recurrence?: ReminderRecurrence;
    channels?: ReminderChannel[];
    analysisId?: string;
    documentId?: string;
    patientId?: string;
  }
): Promise<Reminder> {
  return await apiJson<Reminder>('/api/reminders', {
    method: 'POST',
    body: JSON.stringify({
      title,
      dueAt,
      description: options?.description,
      recurrence: options?.recurrence || 'NONE',
      channels: options?.channels || ['EMAIL'],
      analysisId: options?.analysisId,
      documentId: options?.documentId,
      patientId: options?.patientId,
    }),
  });
}
