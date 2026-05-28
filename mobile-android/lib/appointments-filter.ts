export const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'rescheduled'] as const

export function isActiveAppointmentStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(status)
}

export function isUpcomingActiveAppointment(appointment: {
  scheduledAt: string | Date
  status?: string | null
}): boolean {
  if (!isActiveAppointmentStatus(appointment.status)) return false
  return new Date(appointment.scheduledAt).getTime() > Date.now()
}

export function filterUpcomingActiveAppointments<T extends { scheduledAt: string | Date; status?: string | null }>(
  appointments: T[]
): T[] {
  return appointments.filter(isUpcomingActiveAppointment)
}
