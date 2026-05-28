/** Персистентная история глобального AI-чата в localStorage (до явной очистки). */

export const ASSISTANT_CHAT_STORAGE_VERSION = 1

export const ASSISTANT_WELCOME_CONTENT =
  'Здравствуйте! Я ИИ-ассистент персонального медицинского кабинета (не врач). Помогаю с анализами, дневником, лекарствами, планом ухода, напоминаниями и записью к врачу — без диагнозов и назначений.\n\nКакая задача сегодня: посмотреть анализы, добавить запись в дневник, проверить лекарства или записаться к врачу?\n\nНапишите вопрос — при наличии данных укажу последние отклонения. Примеры: «покажи анализы за месяц», «запиши в дневник: головная боль, сон 6 ч», «выведи отклонения».'

const MAX_STORED_MESSAGES = 150

export type StoredAssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  attachedDocuments?: Array<{ id: string; fileName: string; studyType?: string }>
  functionResult?: unknown
  functionName?: string
  provider?: string
  requestId?: string
  sources?: unknown
}

export type StoredPendingBooking = {
  doctorId: string
  doctorName: string
  specialization?: string | null
  scheduledAt: string
  timeString: string
  appointmentType: string
  notes?: string | null
}

type StoredAssistantChatState = {
  version: typeof ASSISTANT_CHAT_STORAGE_VERSION
  messages: StoredAssistantMessage[]
  pendingBooking: StoredPendingBooking | null
  updatedAt: string
}

export type RestoredAssistantChat = {
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    attachedDocuments?: Array<{ id: string; fileName: string; studyType?: string }>
    functionResult?: unknown
    functionName?: string
    provider?: string
    requestId?: string
    sources?: unknown
  }>
  pendingBooking: StoredPendingBooking | null
}

function decodeJwtUserId(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(normalized)) as { userId?: string }
    return typeof json.userId === 'string' ? json.userId : null
  } catch {
    return null
  }
}

export function getAssistantChatStorageKey(): string {
  if (typeof window === 'undefined') return 'aiAssistantChat:v1:guest'

  const token = window.localStorage.getItem('token')
  const userId = token ? decodeJwtUserId(token) : null
  const caretaker = window.localStorage.getItem('caretakerPatientId')
  const userPart = userId || 'guest'
  const caretakerPart = caretaker ? `:caretaker:${caretaker}` : ''
  return `aiAssistantChat:v${ASSISTANT_CHAT_STORAGE_VERSION}:${userPart}${caretakerPart}`
}

export function createDefaultAssistantMessages(): RestoredAssistantChat['messages'] {
  return [
    {
      id: 'welcome',
      role: 'assistant',
      content: ASSISTANT_WELCOME_CONTENT,
      timestamp: new Date(),
    },
  ]
}

function serializeMessages(messages: RestoredAssistantChat['messages']): StoredAssistantMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : new Date(m.timestamp).toISOString(),
    attachedDocuments: m.attachedDocuments,
    functionResult: m.functionResult,
    functionName: m.functionName,
    provider: m.provider,
    requestId: m.requestId,
    sources: m.sources,
  }))
}

function deserializeMessages(stored: StoredAssistantMessage[]): RestoredAssistantChat['messages'] {
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    attachedDocuments: m.attachedDocuments,
    functionResult: m.functionResult,
    functionName: m.functionName,
    provider: m.provider,
    requestId: m.requestId,
    sources: m.sources as RestoredAssistantChat['messages'][0]['sources'],
  }))
}

export function loadAssistantChatFromStorage(): RestoredAssistantChat | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getAssistantChatStorageKey())
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredAssistantChatState
    if (parsed?.version !== ASSISTANT_CHAT_STORAGE_VERSION) return null
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return null

    return {
      messages: deserializeMessages(parsed.messages),
      pendingBooking: parsed.pendingBooking ?? null,
    }
  } catch {
    return null
  }
}

export function saveAssistantChatToStorage(
  messages: RestoredAssistantChat['messages'],
  pendingBooking: StoredPendingBooking | null
): void {
  if (typeof window === 'undefined') return

  try {
    const trimmed = messages.length > MAX_STORED_MESSAGES ? messages.slice(-MAX_STORED_MESSAGES) : messages
    const payload: StoredAssistantChatState = {
      version: ASSISTANT_CHAT_STORAGE_VERSION,
      messages: serializeMessages(trimmed),
      pendingBooking,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(getAssistantChatStorageKey(), JSON.stringify(payload))
  } catch (e) {
    console.warn('[AIChat] Failed to persist chat history', e)
  }
}

export function clearAssistantChatStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(getAssistantChatStorageKey())
  } catch {
    /* ignore */
  }
}
