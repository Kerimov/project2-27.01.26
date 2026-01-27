import { apiJson } from './client';

export type CarePlanTaskStatus = 'ACTIVE' | 'SNOOZED' | 'COMPLETED';
export type ReminderRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface CarePlanTask {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: CarePlanTaskStatus;
  dueAt?: string | null; // ISO date
  recurrence: ReminderRecurrence;
  snoozedUntil?: string | null; // ISO date
  analysisId?: string | null;
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
  analysis?: {
    id: string;
    title: string;
    date: string;
    status: string;
  } | null;
  document?: {
    id: string;
    fileName: string;
  } | null;
  checkIns?: Array<{
    id: string;
    type: string;
    reason?: string | null;
    createdAt: string;
  }>;
}

export interface CarePlanTasksResponse {
  tasks: CarePlanTask[];
}

export interface CarePlanTaskResponse {
  task: CarePlanTask;
}

export async function getCarePlanTasks(
  status?: CarePlanTaskStatus | null,
  includePending?: boolean
): Promise<CarePlanTask[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (includePending) params.append('includePending', 'true');
  const query = params.toString();
  const url = query ? `/api/care-plan/tasks?${query}` : '/api/care-plan/tasks';
  const data = await apiJson<CarePlanTasksResponse>(url);
  return data.tasks;
}

export async function createCarePlanTask(
  title: string,
  options?: {
    description?: string;
    dueAt?: string; // ISO date
    recurrence?: ReminderRecurrence;
    analysisId?: string;
    documentId?: string;
  }
): Promise<CarePlanTask> {
  const data = await apiJson<CarePlanTaskResponse>('/api/care-plan/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: options?.description,
      dueAt: options?.dueAt,
      recurrence: options?.recurrence || 'NONE',
      analysisId: options?.analysisId,
      documentId: options?.documentId,
    }),
  });
  return data.task;
}

export async function updateCarePlanTask(
  id: string,
  action: 'complete' | 'reopen' | 'snooze' | 'update',
  options?: {
    title?: string;
    description?: string;
    dueAt?: string; // ISO date
    snoozedUntil?: string; // ISO date
    reason?: string; // Required for snooze
  }
): Promise<CarePlanTask> {
  const data = await apiJson<CarePlanTaskResponse>(`/api/care-plan/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action,
      title: options?.title,
      description: options?.description,
      dueAt: options?.dueAt,
      snoozedUntil: options?.snoozedUntil,
      reason: options?.reason,
    }),
  });
  return data.task;
}

export async function deleteCarePlanTask(id: string): Promise<void> {
  await apiJson(`/api/care-plan/tasks/${id}`, { method: 'DELETE' });
}
