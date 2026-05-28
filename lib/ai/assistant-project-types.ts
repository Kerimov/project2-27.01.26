export type AssistantAction =
  | { type: 'select_doctor'; doctorId: string; date?: string | null }
  | { type: 'select_slot'; doctorId: string; scheduledAt: string }
  | { type: 'confirm_booking' }
  | { type: 'cancel_booking' }
  | { type: 'complete_task'; taskId: string }

export type AssistantDoctor = {
  id: string
  name: string
  email?: string | null
  specialization: string
  experience?: number | null
  clinic?: string | null
  phone?: string | null
  consultationFee?: number | null
}

export type AssistantSlot = {
  time: string
  timeString: string
  available: boolean
}

export type PendingBooking = {
  doctorId: string
  doctorName: string
  specialization?: string | null
  scheduledAt: string
  timeString: string
  appointmentType: string
  notes?: string | null
}

import type { AssistantCard, AssistantSafety, AssistantUiAction } from './assistant-contract'

export type AssistantProjectActionResult = {
  message: string
  data: Record<string, unknown>
  functionName: string
  cards?: AssistantCard[]
  actions?: AssistantUiAction[]
  safety?: AssistantSafety
}
