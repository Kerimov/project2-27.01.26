/** Календарные дата/время приёма в часовом поясе клиники (по умолчанию Москва). */
export const APPOINTMENT_TIME_ZONE = 'Europe/Moscow'

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

export function parseDateYmd(dateYmd: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd)
  if (!match) throw new Error(`Invalid date: ${dateYmd}`)
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

/** Момент UTC, соответствующий «стенным» часам dateYmd + timeHm в Москве. */
export function makeMoscowDateTime(dateYmd: string, timeHm: string): Date {
  const { year, month, day } = parseDateYmd(dateYmd)
  const [hh, mm] = timeHm.split(':').map((part) => Number(part))
  if (Number.isNaN(hh) || Number.isNaN(mm)) throw new Error(`Invalid time: ${timeHm}`)
  return new Date(Date.UTC(year, month - 1, day, hh - 3, mm, 0, 0))
}

export function getMoscowDateYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APPOINTMENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addMoscowDays(dateYmd: string, days: number): string {
  const anchor = makeMoscowDateTime(dateYmd, '12:00')
  return getMoscowDateYmd(new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000))
}

export function formatMoscowTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APPOINTMENT_TIME_ZONE,
  })
}

export function formatMoscowDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('ru-RU', {
    timeZone: APPOINTMENT_TIME_ZONE,
    ...options,
  })
}

export function getMoscowHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: APPOINTMENT_TIME_ZONE,
      hour: 'numeric',
      hour12: false,
    }).format(date)
  )
}

export function getMoscowMinutes(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: APPOINTMENT_TIME_ZONE,
      minute: 'numeric',
    }).format(date)
  )
}

/** Согласовать ISO из слота с отображаемым timeString (защита от сдвига TZ сервера). */
export function resolveAppointmentInstant(scheduledAtIso: string, timeHm: string): Date {
  const ymd = getMoscowDateYmd(new Date(scheduledAtIso))
  return makeMoscowDateTime(ymd, timeHm)
}
