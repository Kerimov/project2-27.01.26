import { prisma } from '@/lib/db'
import {
  addMoscowDays,
  formatMoscowDate,
  formatMoscowTime,
  getMoscowDateYmd,
  getMoscowHour,
  getMoscowMinutes,
  makeMoscowDateTime,
  parseDateYmd,
  resolveAppointmentInstant,
} from '@/lib/appointment-local-datetime'
import { isAnalysisListOnlyRequest } from './assistant-analysis-intent'
import { isDiaryWriteIntent } from './assistant-diary-intent'
import type { AssistantIntent } from './assistant-router'
import type {
  AssistantAction,
  AssistantDoctor,
  AssistantProjectActionResult,
  AssistantSlot,
  PendingBooking,
} from './assistant-project-types'
import {
  isYesIntent,
  isNoIntent,
  isAddDiaryIntent,
  isDiaryReviewIntent,
  isAddCarePlanTaskIntent,
  isBookingIntent,
} from './assistant-project-intents'

export type {
  AssistantAction,
  AssistantDoctor,
  AssistantSlot,
  PendingBooking,
  AssistantProjectActionResult,
} from './assistant-project-types'

export { isCarePlanIntent } from './assistant-project-intents'

export function getStatusLabel(status: string): string {
  switch (status) {
    case "scheduled": return "Запланировано"
    case "confirmed": return "Подтверждено"
    case "completed": return "Завершено"
    case "cancelled": return "Отменено"
    case "rescheduled": return "Перенесено"
    default: return status
  }
}

function extractTaskTitle(message: string): string | null {
  const quoted = message.match(/задач[ауи]:\s*([^\n.]+)/i)
  if (quoted?.[1]) return quoted[1].trim().slice(0, 200)
  const free = message.match(/(?:добав|создай)(?:ить)?\s+задач[ау]?\s+(.+)/i)
  if (free?.[1]) return free[1].trim().slice(0, 200)
  return null
}

function extractDiaryFieldsFromMessage(message: string) {
  const fields: {
    mood?: number
    painScore?: number
    sleepHours?: number
    steps?: number
    temperature?: number
    weight?: number
    pulse?: number
    systolic?: number
    diastolic?: number
    symptoms?: string
    notes?: string
  } = {}
  const mood = message.match(/настроен(?:ие)?\s*[:\s]*(\d)/i)
  const pain = message.match(/боль\s*[:\s]*(\d+)/i)
  const sleep = message.match(/сон\s*[:\s]*(\d+(?:[.,]\d+)?)/i)
  const steps = message.match(/шаг\w*\s*[:\s]*(\d+)/i)
  const temp = message.match(/температур\w*\s*[:\s]*(\d+(?:[.,]\d+)?)/i)
  const weight = message.match(/вес\s*[:\s]*(\d+(?:[.,]\d+)?)/i)
  const pulse = message.match(/пульс\s*[:\s]*(\d+)/i)
  const bp = message.match(/давлен\w*\s*[:\s]*(\d+)\s*[/\s]\s*(\d+)/i)

  if (mood?.[1]) fields.mood = Math.min(5, Math.max(1, Number(mood[1])))
  if (pain?.[1]) fields.painScore = Math.min(10, Math.max(0, Number(pain[1])))
  if (sleep?.[1]) fields.sleepHours = Number(String(sleep[1]).replace(',', '.'))
  if (steps?.[1]) fields.steps = Number(steps[1])
  if (temp?.[1]) fields.temperature = Number(String(temp[1]).replace(',', '.'))
  if (weight?.[1]) fields.weight = Number(String(weight[1]).replace(',', '.'))
  if (pulse?.[1]) fields.pulse = Number(pulse[1])
  if (bp?.[1] && bp?.[2]) {
    fields.systolic = Number(bp[1])
    fields.diastolic = Number(bp[2])
  }

  const cleaned = message
    .replace(/добавь|запиш|внеси|в дневник|дневник/gi, '')
    .replace(/настроен(?:ие)?\s*[:\s]*\d/gi, '')
    .replace(/боль\s*[:\s]*\d+/gi, '')
    .replace(/сон\s*[:\s]*\d+(?:[.,]\d+)?/gi, '')
    .trim()
  if (cleaned.length >= 3) fields.notes = cleaned.slice(0, 2000)
  else if (/симптом/i.test(message)) {
    const sym = message.match(/симптом\w*\s*[:\s]*([^\n.]+)/i)
    if (sym?.[1]) fields.symptoms = sym[1].trim().slice(0, 500)
  }

  return fields
}

function formatDiaryLine(entry: any) {
  const date = new Date(entry.entryDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const parts: string[] = []
  if (entry.mood != null) parts.push(`настроение ${entry.mood}/5`)
  if (entry.painScore != null) parts.push(`боль ${entry.painScore}/10`)
  if (entry.sleepHours != null) parts.push(`сон ${entry.sleepHours} ч`)
  if (entry.systolic != null && entry.diastolic != null) parts.push(`АД ${entry.systolic}/${entry.diastolic}`)
  if (entry.notes) parts.push(String(entry.notes).slice(0, 80))
  return `• ${date}: ${parts.length ? parts.join(', ') : 'запись без показателей'}`
}

function formatMedicationLine(med: any) {
  const times = Array.isArray(med.times) ? med.times.join(', ') : ''
  const dose = med.dosage ? `, ${med.dosage}` : ''
  const freq = med.frequencyPerDay ? `, ${med.frequencyPerDay}×/день` : ''
  const tag = med.isSupplement ? ' (БАД)' : ''
  return `• ${med.name}${tag}${dose}${freq}${times ? `, ${times}` : ''}`
}

function formatCarePlanTaskLine(task: any, index: number) {
  const due = task.dueAt || task.snoozedUntil
  const dueStr = due ? `, срок ${new Date(due).toLocaleDateString('ru-RU')}` : ''
  const status =
    task.status === 'COMPLETED' ? 'выполнено' : task.status === 'SNOOZED' ? 'отложено' : 'активно'
  return `${index + 1}. ${task.title} (${status}${dueStr})`
}

function formatAppointmentLine(appointment: any, index: number) {
  const date = new Date(appointment.scheduledAt)
  const doctorName = appointment.doctor?.user?.name || appointment.doctorName || 'Врач'
  const specialization = appointment.doctor?.specialization ? `, ${appointment.doctor.specialization}` : ''
  return `${index + 1}. ${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — ${doctorName}${specialization}, статус: ${getStatusLabel(appointment.status)}`
}

function formatReminderLine(reminder: any, index: number) {
  const date = new Date(reminder.dueAt)
  const recurrence = reminder.recurrence && reminder.recurrence !== 'NONE' ? `, повтор: ${reminder.recurrence}` : ''
  return `${index + 1}. ${reminder.title} — ${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${recurrence}`
}

function formatDocumentLine(doc: any, index: number) {
  const date = doc.studyDate || doc.uploadDate
  const dateStr = date ? new Date(date).toLocaleDateString('ru-RU') : 'дата не указана'
  return `${index + 1}. ${doc.fileName}${doc.studyType ? ` (${doc.studyType})` : ''} — ${dateStr}`
}

function formatAnalysisLine(analysis: any, index: number) {
  const date = analysis.date || analysis.createdAt
  const dateStr = date ? new Date(date).toLocaleDateString('ru-RU') : 'дата не указана'
  return `${index + 1}. ${analysis.title || analysis.type || 'Анализ'} — ${dateStr}, статус: ${analysis.status || '—'}`
}

async function listAssistantAppointments(userId: string, params?: { upcoming?: boolean; status?: string }) {
  const where: any = { patientId: userId }
  if (params?.status) where.status = params.status
  if (params?.upcoming !== false) where.scheduledAt = { gte: new Date() }
  return prisma.appointment.findMany({
    where,
    include: { doctor: { include: { user: true } } },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  })
}

async function listAssistantReminders(userId: string) {
  return prisma.reminder.findMany({
    where: { userId },
    orderBy: { dueAt: 'asc' },
    take: 10,
  })
}

async function listAssistantDocuments(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { uploadDate: 'desc' },
    take: 10,
    select: { id: true, fileName: true, studyType: true, uploadDate: true, studyDate: true },
  })
}

async function listAssistantAnalyses(userId: string) {
  return prisma.analysis.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 10,
    select: { id: true, title: true, type: true, date: true, status: true, createdAt: true },
  })
}

async function listDiaryEntries(userId: string, limit = 7) {
  return prisma.healthDiaryEntry.findMany({
    where: { userId },
    orderBy: { entryDate: 'desc' },
    take: limit,
    include: { tags: { include: { tag: true } } },
  })
}

async function createDiaryEntryFromMessage(userId: string, message: string) {
  const fields = extractDiaryFieldsFromMessage(message)
  const hasNumeric =
    fields.mood != null ||
    fields.painScore != null ||
    fields.sleepHours != null ||
    fields.steps != null ||
    fields.notes ||
    fields.symptoms != null

  if (!hasNumeric) {
    throw new Error('Укажите показатели: например «боль 4, сон 7» или заметку.')
  }

  return prisma.healthDiaryEntry.create({
    data: {
      userId,
      entryDate: new Date(),
      mood: typeof fields.mood === 'number' ? fields.mood : undefined,
      painScore: typeof fields.painScore === 'number' ? fields.painScore : undefined,
      sleepHours: typeof fields.sleepHours === 'number' ? fields.sleepHours : undefined,
      steps: typeof fields.steps === 'number' ? fields.steps : undefined,
      temperature: typeof fields.temperature === 'number' ? fields.temperature : undefined,
      weight: typeof fields.weight === 'number' ? fields.weight : undefined,
      pulse: typeof fields.pulse === 'number' ? fields.pulse : undefined,
      systolic: typeof fields.systolic === 'number' ? fields.systolic : undefined,
      diastolic: typeof fields.diastolic === 'number' ? fields.diastolic : undefined,
      symptoms: fields.symptoms,
      notes: typeof fields.notes === 'string' ? fields.notes : undefined,
    },
    include: { tags: { include: { tag: true } } },
  })
}

async function summarizeDiaryWeek(userId: string) {
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  const entries = await prisma.healthDiaryEntry.findMany({
    where: { userId, entryDate: { gte: start, lte: end } },
    orderBy: { entryDate: 'asc' },
  })

  if (entries.length === 0) {
    return { text: 'За последние 7 дней записей в дневнике нет. Добавьте самочувствие в разделе «Дневник → Записи».', entries: [] }
  }

  const avg = (key: 'mood' | 'painScore' | 'sleepHours') => {
    const vals = entries.map((e) => e[key]).filter((v): v is number => typeof v === 'number')
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const mood = avg('mood')
  const pain = avg('painScore')
  const sleep = avg('sleepHours')
  const headacheDays = entries.filter(
    (e) =>
      (e.painScore != null && e.painScore >= 4) ||
      /головн/i.test(`${e.symptoms || ''} ${e.notes || ''}`)
  ).length
  const lowSleepDays = entries.filter((e) => e.sleepHours != null && e.sleepHours < 6).length

  const insights: string[] = []
  if (headacheDays >= 2 && sleep != null && sleep < 6.5) {
    insights.push(
      `На этой неделе головная боль/высокая боль отмечалась ${headacheDays} раз — часто на фоне недосыпа (ср. сон ${sleep} ч). Попробуйте ложиться на 30 мин раньше.`
    )
  } else if (headacheDays >= 2) {
    insights.push(`Боль/дискомфорт отмечались ${headacheDays} раз за неделю — зафиксируйте триггеры в дневнике.`)
  }
  if (lowSleepDays >= 3) {
    insights.push(`Недосып (${lowSleepDays} дн. < 6 ч) — может влиять на давление и самочувствие.`)
  }

  const lines = [
    `**AI-обзор недели** (записей: ${entries.length})`,
    mood != null ? `• Среднее настроение: ${mood}/5` : null,
    pain != null ? `• Средняя боль: ${pain}/10` : null,
    sleep != null ? `• Средний сон: ${sleep} ч` : null,
    insights.length ? `\n${insights.join('\n')}` : null,
    '\nНе диагноз. Хотите добавить задачу в план ухода (например, замер давления вечером)?',
  ].filter(Boolean)

  return { text: lines.join('\n'), entries }
}

async function listPatientMedications(userId: string) {
  return prisma.patientMedication.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
}

async function listCarePlanTasks(userId: string, status?: 'ACTIVE' | 'SNOOZED' | 'COMPLETED') {
  return prisma.carePlanTask.findMany({
    where: {
      userId,
      approvalStatus: 'APPROVED',
      ...(status ? { status } : {}),
    },
    include: {
      analysis: { select: { id: true, title: true } },
      document: { select: { id: true, fileName: true } },
    },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  })
}

async function completeCarePlanTaskById(userId: string, taskId: string, reason?: string) {
  const task = await prisma.carePlanTask.findFirst({ where: { id: taskId, userId } })
  if (!task) throw new Error('Задача не найдена')

  const updated = await prisma.carePlanTask.update({
    where: { id: taskId },
    data: { status: 'COMPLETED', snoozedUntil: null },
  })

  await prisma.carePlanCheckIn.create({
    data: {
      taskId,
      type: 'COMPLETE',
      reason: reason?.trim()?.slice(0, 800) || 'Выполнено через AI-чат',
    },
  })

  return updated
}

async function createCarePlanTaskFromMessage(userId: string, message: string) {
  const title = extractTaskTitle(message)
  if (!title) throw new Error('Укажите название задачи, например: «Добавь задачу: сдать анализ крови».')

  return prisma.carePlanTask.create({
    data: {
      userId,
      title,
      description: null,
      recurrence: 'NONE',
    },
  })
}

function extractAppointmentType(message: string) {
  if (/повторн|контрольн/i.test(message)) return 'follow_up'
  if (/планов|профилактич/i.test(message)) return 'routine'
  if (/срочн|экстрен/i.test(message)) return 'emergency'
  return 'consultation'
}

function extractDateFromMessage(message: string): string | null {
  const dateMatch = message.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?|(завтра|послезавтра|сегодня)/i)
  if (!dateMatch) return null

  if (dateMatch[4]) {
    const word = dateMatch[4].toLowerCase()
    const todayYmd = getMoscowDateYmd()
    if (word === 'сегодня') return todayYmd
    if (word === 'завтра') return addMoscowDays(todayYmd, 1)
    if (word === 'послезавтра') return addMoscowDays(todayYmd, 2)
  }

  if (dateMatch[1] && dateMatch[2]) {
    const day = dateMatch[1].padStart(2, '0')
    const month = dateMatch[2].padStart(2, '0')
    const rawYear = dateMatch[3] || String(new Date().getFullYear())
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return `${year}-${month}-${day}`
  }

  return null
}

function extractTimeFromMessage(message: string): string | null {
  const timeMatch = message.match(/(?:в\s*)?(\d{1,2})(?::|\.)(\d{2})/)
  if (!timeMatch) return null
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function extractSpecializationFromMessage(message: string): string | null {
  if (/терапевт|семейн/i.test(message)) return 'Терапевт'
  if (/кардиолог|сердц/i.test(message)) return 'Кардиолог'
  if (/невролог|головн/i.test(message)) return 'Невролог'
  if (/эндокринолог|диабет|гормон/i.test(message)) return 'Эндокринолог'
  if (/гинеколог/i.test(message)) return 'Гинеколог'
  if (/дерматолог|кож/i.test(message)) return 'Дерматолог'
  return null
}

function formatDoctorForAssistant(doctor: any): AssistantDoctor {
  return {
    id: doctor.id,
    name: doctor.user?.name || 'Врач',
    email: doctor.user?.email || null,
    specialization: doctor.specialization,
    experience: doctor.experience,
    clinic: doctor.clinic,
    phone: doctor.phone,
    consultationFee: doctor.consultationFee,
  }
}

function formatDoctorLine(doctor: AssistantDoctor, index: number) {
  const details = [
    doctor.specialization,
    doctor.clinic ? `клиника: ${doctor.clinic}` : null,
    typeof doctor.experience === 'number' ? `стаж ${doctor.experience} лет` : null,
  ].filter(Boolean).join(', ')
  return `${index + 1}. ${doctor.name}${details ? ` — ${details}` : ''}`
}

async function findAssistantDoctors(params: { specialization?: string | null; doctorId?: string | null; query?: string | null }) {
  const doctors = await prisma.doctorProfile.findMany({
    where: {
      isActive: true,
      ...(params.doctorId ? { id: params.doctorId } : {}),
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        }
      }
    },
    orderBy: {
      user: {
        name: 'asc',
      }
    },
    take: params.doctorId ? 1 : 30,
  })

  const specialization = params.specialization?.toLowerCase()
  const query = params.query?.toLowerCase()

  return doctors
    .filter((doctor) => {
      if (specialization && !doctor.specialization.toLowerCase().includes(specialization)) return false
      if (query) {
        const haystack = `${doctor.user?.name || ''} ${doctor.specialization || ''} ${doctor.clinic || ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
    .map(formatDoctorForAssistant)
}

function makeDateTime(date: string, time: string) {
  return makeMoscowDateTime(date, time)
}

async function getAssistantSlots(doctorId: string, dateYmd: string): Promise<AssistantSlot[]> {
  try {
    parseDateYmd(dateYmd)
  } catch {
    return []
  }

  const dayStart = makeMoscowDateTime(dateYmd, '00:00')
  const dayEndExclusive = makeMoscowDateTime(addMoscowDays(dateYmd, 1), '00:00')
  const slotStart = makeMoscowDateTime(dateYmd, '09:00')
  const slotEnd = makeMoscowDateTime(dateYmd, '21:00')

  const bookedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledAt: {
        gte: dayStart,
        lt: dayEndExclusive,
      },
      status: {
        in: ['scheduled', 'confirmed'],
      },
    },
    select: { scheduledAt: true },
  })

  const booked = new Set(bookedAppointments.map((a) => new Date(a.scheduledAt).getTime()))
  const slots: AssistantSlot[] = []
  const now = new Date()
  let current = slotStart

  while (current < slotEnd) {
    if (current > now) {
      const isBooked = booked.has(current.getTime())
      slots.push({
        time: current.toISOString(),
        timeString: formatMoscowTime(current),
        available: !isBooked,
      })
    }
    current = new Date(current.getTime() + 15 * 60 * 1000)
  }

  return slots
}

async function getNextAssistantSlots(doctorId: string, daysAhead = 7, limit = 8) {
  const result: Array<AssistantSlot & { date: string }> = []
  const todayYmd = getMoscowDateYmd()

  for (let offset = 0; offset < daysAhead && result.length < limit; offset += 1) {
    const date = addMoscowDays(todayYmd, offset)
    const slots = (await getAssistantSlots(doctorId, date)).filter((slot) => slot.available)
    for (const slot of slots) {
      result.push({ ...slot, date })
      if (result.length >= limit) break
    }
  }

  return result
}

function buildDateOptions(daysAhead = 7) {
  const todayYmd = getMoscowDateYmd()
  return Array.from({ length: daysAhead }, (_, offset) => {
    const date = addMoscowDays(todayYmd, offset)
    const label =
      offset === 0
        ? 'Сегодня'
        : offset === 1
          ? 'Завтра'
          : formatMoscowDate(makeMoscowDateTime(date, '12:00'), { day: '2-digit', month: '2-digit' })
    return { date, label }
  })
}

function buildPendingBooking(doctor: AssistantDoctor, scheduledAt: string, appointmentType: string, notes?: string | null): PendingBooking {
  const instant = new Date(scheduledAt)
  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialization: doctor.specialization,
    scheduledAt: instant.toISOString(),
    timeString: formatMoscowTime(instant),
    appointmentType,
    notes: notes || null,
  }
}

export function isPendingBooking(value: any): value is PendingBooking {
  return Boolean(
    value &&
    typeof value.doctorId === 'string' &&
    typeof value.doctorName === 'string' &&
    typeof value.scheduledAt === 'string' &&
    typeof value.appointmentType === 'string'
  )
}

async function createAppointmentFromPending(userId: string, pending: PendingBooking) {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: pending.doctorId, isActive: true },
    include: {
      user: { select: { name: true, email: true } }
    }
  })

  if (!doctor) throw new Error('Врач не найден или больше недоступен для записи')

  const patient = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true, email: true }
  })

  if (!patient || patient.role !== 'PATIENT') {
    throw new Error('Только пациенты могут записываться на прием')
  }

  const appointmentDate = resolveAppointmentInstant(pending.scheduledAt, pending.timeString)
  if (Number.isNaN(appointmentDate.getTime())) throw new Error('Некорректное время записи')
  if (appointmentDate <= new Date()) throw new Error('Нельзя записаться на прошедшее время')

  const hour = getMoscowHour(appointmentDate)
  if (hour < 9 || hour >= 21) throw new Error('Запись возможна только с 9:00 до 21:00')

  const minutes = getMoscowMinutes(appointmentDate)
  if (minutes % 15 !== 0) throw new Error('Время записи должно быть кратно 15 минутам')

  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId: pending.doctorId,
      scheduledAt: appointmentDate,
      status: { in: ['scheduled', 'confirmed'] },
    },
    include: {
      doctor: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
    },
  })

  if (existingAppointment) {
    if (existingAppointment.patientId === userId) return existingAppointment
    throw new Error('Это время уже занято')
  }

  const appointment = await prisma.appointment.create({
    data: {
      doctorId: pending.doctorId,
      patientId: userId,
      patientName: patient.name,
      patientEmail: patient.email,
      appointmentType: pending.appointmentType || 'consultation',
      scheduledAt: appointmentDate,
      duration: 15,
      status: 'scheduled',
      notes: pending.notes || null,
    },
    include: {
      doctor: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      }
    }
  })

  try {
    const pref = await prisma.reminderPreference.findUnique({
      where: { userId },
      select: { email: true, push: true, sms: true },
    })
    const channels = [pref?.email ? 'EMAIL' : null, pref?.push ? 'PUSH' : null, pref?.sms ? 'SMS' : null].filter(Boolean)
    const reminderChannels = channels.length ? channels : ['PUSH']

    const pre48 = new Date(appointmentDate.getTime() - 48 * 60 * 60 * 1000)
    if (pre48.getTime() > Date.now()) {
      await prisma.reminder.create({
        data: {
          userId,
          title: 'Подготовка к приёму: заполните анкету',
          description: 'За 24–48 часов до приёма заполните анкету. Откройте: /my-appointments',
          dueAt: pre48,
          recurrence: 'NONE',
          channels: reminderChannels,
        }
      })
    }

    const pre2 = new Date(appointmentDate.getTime() - 2 * 60 * 60 * 1000)
    if (pre2.getTime() > Date.now()) {
      await prisma.reminder.create({
        data: {
          userId,
          title: 'Приём скоро',
          description: 'Через 2 часа приём. Откройте: /my-appointments',
          dueAt: pre2,
          recurrence: 'NONE',
          channels: reminderChannels,
        }
      })
    }

    const post24 = new Date(appointmentDate.getTime() + 24 * 60 * 60 * 1000)
    if (post24.getTime() > Date.now()) {
      await prisma.reminder.create({
        data: {
          userId,
          title: 'После приёма',
          description: 'Добавьте кратко самочувствие/итоги визита в дневник и проверьте назначения. Откройте: /diary',
          dueAt: post24,
          recurrence: 'NONE',
          channels: reminderChannels,
        }
      })
    }
  } catch (e) {
    console.warn('[AI-ASSISTANT] Failed to create appointment reminders', e)
  }

  return appointment
}

export async function handleProjectActionIntent(input: {
  message: string
  userId: string
  action?: AssistantAction
  pendingBooking?: PendingBooking
  intent?: string
  patientPrefix?: string
}): Promise<AssistantProjectActionResult | null> {
  const { message, userId, action, intent } = input
  const pendingBooking = isPendingBooking(input.pendingBooking) ? input.pendingBooking : null

  if (action?.type === 'cancel_booking' || (pendingBooking && isNoIntent(message))) {
    return {
      functionName: 'cancel_booking',
      message: 'Хорошо, запись не создаю. Можно выбрать другого врача или другое время.',
      data: { action: 'booking_cancelled' },
    }
  }

  if (action?.type === 'confirm_booking' || (pendingBooking && isYesIntent(message))) {
    if (!pendingBooking) {
      return {
        functionName: 'confirm_booking',
        message: 'Не вижу выбранного слота для подтверждения. Сначала выберите врача и время.',
        data: { action: 'booking_missing' },
      }
    }

    try {
      const appointment = await createAppointmentFromPending(userId, pendingBooking)
      const scheduledAt = new Date(appointment.scheduledAt)
      return {
        functionName: 'book_appointment',
        message: `Запись создана: ${formatMoscowDate(scheduledAt)} в ${formatMoscowTime(scheduledAt)}, врач ${appointment.doctor.user.name}. Она появится в разделе «Мои записи».`,
        data: {
          action: 'appointment_created',
          appointment,
        },
      }
    } catch (e) {
      return {
        functionName: 'book_appointment',
        message: e instanceof Error ? e.message : 'Не удалось создать запись. Попробуйте выбрать другой слот.',
        data: { action: 'appointment_error', pendingBooking },
      }
    }
  }

  if (action?.type === 'select_slot') {
    const doctors = await findAssistantDoctors({ doctorId: action.doctorId })
    const doctor = doctors[0]
    if (!doctor) {
      return {
        functionName: 'select_slot',
        message: 'Врач не найден. Попробуйте выбрать врача заново.',
        data: { action: 'doctor_missing' },
      }
    }

    const pending = buildPendingBooking(doctor, action.scheduledAt, extractAppointmentType(message))
    const date = new Date(action.scheduledAt)
    return {
      functionName: 'select_slot',
      message: `Подтвердите запись: ${doctor.name}, ${doctor.specialization}, ${formatMoscowDate(date)} в ${pending.timeString}. Записать?`,
      data: {
        action: 'booking_pending',
        pendingBooking: pending,
      },
    }
  }

  if (action?.type === 'complete_task') {
    try {
      const task = await completeCarePlanTaskById(userId, action.taskId, message)
      return {
        functionName: 'complete_task',
        message: `Задача «${task.title}» отмечена выполненной. Откройте «Дневник → План» для остальных задач.`,
        data: { action: 'task_completed', task },
      }
    } catch (e) {
      return {
        functionName: 'complete_task',
        message: e instanceof Error ? e.message : 'Не удалось обновить задачу',
        data: { action: 'task_error' },
      }
    }
  }

  if (isDiaryWriteIntent(message)) {
    try {
      const entry = await createDiaryEntryFromMessage(userId, message)
      return {
        functionName: 'add_diary_entry',
        message: `Запись добавлена в дневник на ${new Date(entry.entryDate).toLocaleString('ru-RU')}. Откройте «Дневник → Записи» для просмотра.`,
        data: { action: 'diary_entry_created', entry },
      }
    } catch (e) {
      return {
        functionName: 'add_diary_entry',
        message: e instanceof Error ? e.message : 'Не удалось сохранить запись',
        data: { action: 'diary_error' },
      }
    }
  }

  if (intent === 'appointments') {
    const upcoming = !/прошедш|истори|все записи|все при[её]м/i.test(message)
    const appointments = await listAssistantAppointments(userId, {
      upcoming,
      status: /отмен[её]н|cancel/i.test(message) ? 'cancelled' : undefined,
    })

    if (appointments.length === 0) {
      return {
        functionName: 'get_appointments',
        message: upcoming
          ? 'У вас нет предстоящих записей на приём. Если хотите записаться, напишите: «запиши меня к врачу» или «найди терапевта».'
          : 'У вас пока нет записей на приёмы.',
        data: { action: 'appointments_empty', appointments: [], link: '/my-appointments' },
      }
    }

    return {
      functionName: 'get_appointments',
      message: `Ваши ${upcoming ? 'предстоящие ' : ''}записи на приём:\n${appointments.map(formatAppointmentLine).join('\n')}\n\nПолный список: /my-appointments`,
      data: { action: 'appointments', appointments, link: '/my-appointments' },
    }
  }

  if (intent === 'reminders') {
    const reminders = await listAssistantReminders(userId)
    if (reminders.length === 0) {
      return {
        functionName: 'get_reminders',
        message: 'У вас нет напоминаний. Создать новое можно в разделе «Напоминания».',
        data: { action: 'reminders_empty', reminders: [], link: '/reminders' },
      }
    }

    return {
      functionName: 'get_reminders',
      message: `Ваши ближайшие напоминания:\n${reminders.map(formatReminderLine).join('\n')}\n\nУправление: /reminders`,
      data: { action: 'reminders', reminders, link: '/reminders' },
    }
  }

  if (intent === 'documents') {
    const documents = await listAssistantDocuments(userId)
    if (documents.length === 0) {
      return {
        functionName: 'get_documents',
        message: 'Документов пока нет. Загрузите анализы или медицинские документы в разделе «Документы».',
        data: { action: 'documents_empty', documents: [], link: '/documents' },
      }
    }

    return {
      functionName: 'get_documents',
      message: `Ваши последние документы:\n${documents.map(formatDocumentLine).join('\n')}\n\nОткрыть документы: /documents`,
      data: { action: 'documents', documents, link: '/documents' },
    }
  }

  if (intent === 'analyses' && isAnalysisListOnlyRequest(message)) {
    const analyses = await listAssistantAnalyses(userId)
    if (analyses.length === 0) {
      return {
        functionName: 'get_analysis_results',
        message: 'Анализов пока нет. Загрузите документ с анализом в разделе «Документы», после распознавания он появится в «Анализы».',
        data: { action: 'analyses_empty', analyses: [], link: '/analyses' },
      }
    }

    return {
      functionName: 'get_analysis_results',
      message: `Ваши последние анализы:\n${analyses.map(formatAnalysisLine).join('\n')}\n\nОткрыть анализы: /analyses`,
      data: { action: 'analyses', analyses, link: '/analyses' },
    }
  }

  if (intent === 'diary') {
    if (isDiaryReviewIntent(message)) {
      const review = await summarizeDiaryWeek(userId)
      return {
        functionName: 'diary_weekly_review',
        message: review.text,
        data: { action: 'diary_review', entries: review.entries?.slice(0, 5) },
      }
    }

    if (isAddDiaryIntent(message)) {
      try {
        const entry = await createDiaryEntryFromMessage(userId, message)
        return {
          functionName: 'add_diary_entry',
          message: `Запись добавлена в дневник на ${new Date(entry.entryDate).toLocaleString('ru-RU')}. Откройте «Дневник → Записи» для просмотра.`,
          data: { action: 'diary_entry_created', entry },
        }
      } catch (e) {
        return {
          functionName: 'add_diary_entry',
          message: e instanceof Error ? e.message : 'Не удалось сохранить запись',
          data: { action: 'diary_error' },
        }
      }
    }

    const entries = await listDiaryEntries(userId, 7)
    if (entries.length === 0) {
      return {
        functionName: 'get_diary_entries',
        message: 'В дневнике пока нет записей. Напишите, например: «запиши в дневник: боль 3, сон 8» — или откройте «Дневник → Записи».',
        data: { action: 'diary_empty', entries: [], link: '/diary' },
      }
    }

    return {
      functionName: 'get_diary_entries',
      message: `Последние записи дневника:\n${entries.map(formatDiaryLine).join('\n')}\n\nПолный дневник: /diary`,
      data: { action: 'diary_entries', entries, link: '/diary' },
    }
  }

  if (intent === 'medications') {
    const meds = await listPatientMedications(userId)
    if (meds.length === 0) {
      return {
        functionName: 'get_medications',
        message: 'Список лекарств пуст. Добавьте препараты в «Дневник → Лекарства».',
        data: { action: 'medications_empty', medications: [], link: '/diary?tab=medications' },
      }
    }

    return {
      functionName: 'get_medications',
      message: `Ваши лекарства и БАДы (${meds.length}):\n${meds.slice(0, 10).map(formatMedicationLine).join('\n')}\n\nУправление: /diary?tab=medications`,
      data: { action: 'medications', medications: meds.slice(0, 10), link: '/diary?tab=medications' },
    }
  }

  if (intent === 'care_plan') {
    if (isAddCarePlanTaskIntent(message)) {
      try {
        const task = await createCarePlanTaskFromMessage(userId, message)
        return {
          functionName: 'add_care_plan_task',
          message: `Задача «${task.title}» добавлена в план. Смотрите «Дневник → План».`,
          data: { action: 'task_created', task, link: '/diary?tab=plan' },
        }
      } catch (e) {
        return {
          functionName: 'add_care_plan_task',
          message: e instanceof Error ? e.message : 'Не удалось создать задачу',
          data: { action: 'task_error' },
        }
      }
    }

    const [active, pending] = await Promise.all([
      listCarePlanTasks(userId, 'ACTIVE'),
      prisma.carePlanTask.findMany({
        where: { userId, approvalStatus: 'PENDING' },
        orderBy: { approvalRequestedAt: 'desc' },
        take: 5,
      }),
    ])

    const snoozed = await listCarePlanTasks(userId, 'SNOOZED')
    const allForDisplay = [...pending, ...active, ...snoozed].slice(0, 12)

    if (allForDisplay.length === 0) {
      return {
        functionName: 'get_care_plan_tasks',
        message: 'Активных задач в плане нет. Напишите «добавь задачу: …» или откройте «Дневник → План».',
        data: { action: 'tasks_empty', tasks: [], link: '/diary?tab=plan' },
      }
    }

    const pendingNote = pending.length
      ? `\n\nОжидают согласования (${pending.length}): ${pending.map((t) => t.title).join('; ')}`
      : ''

    return {
      functionName: 'get_care_plan_tasks',
      message: `Ваш план действий:\n${allForDisplay.map(formatCarePlanTaskLine).join('\n')}${pendingNote}\n\nОткройте «Дневник → План» для управления.`,
      data: {
        action: 'care_plan_tasks',
        tasks: allForDisplay.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueAt: t.dueAt,
          snoozedUntil: t.snoozedUntil,
          approvalStatus: t.approvalStatus,
        })),
        link: '/diary?tab=plan',
      },
    }
  }

  if (action?.type === 'select_doctor') {
    const doctors = await findAssistantDoctors({ doctorId: action.doctorId })
    const doctor = doctors[0]
    if (!doctor) {
      return {
        functionName: 'select_doctor',
        message: 'Врач не найден. Попробуйте выбрать врача заново.',
        data: { action: 'doctor_missing' },
      }
    }

    const date = action.date || extractDateFromMessage(message)
    if (!date) {
      return {
        functionName: 'select_doctor',
        message: `Вы выбрали ${doctor.name}. Теперь выберите дату для поиска свободных слотов.`,
        data: { action: 'date_required', doctors: [doctor], dateOptions: buildDateOptions(7) },
      }
    }

    const slots = (await getAssistantSlots(doctor.id, date)).filter((slot) => slot.available).slice(0, 8)
    return {
      functionName: 'get_available_slots',
      message: slots.length
        ? `Свободное время у ${doctor.name} на ${formatMoscowDate(makeMoscowDateTime(date, '12:00'))}: ${slots.map((s) => s.timeString).join(', ')}. Выберите слот.`
        : `На ${formatMoscowDate(makeMoscowDateTime(date, '12:00'))} у ${doctor.name} свободных слотов нет. Попробуйте другую дату.`,
      data: { action: 'slots', doctors: [doctor], slots, date },
    }
  }

  if (intent !== 'doctors' && intent !== 'booking') return null

  const specialization = extractSpecializationFromMessage(message)
  const date = extractDateFromMessage(message)
  const time = extractTimeFromMessage(message)
  const appointmentType = extractAppointmentType(message)
  const wantsBooking = isBookingIntent(message)
  const doctors = await findAssistantDoctors({ specialization })

  if (doctors.length === 0) {
    return {
      functionName: 'get_doctors',
      message: specialization
        ? `В каталоге пока нет активных врачей по специализации «${specialization}».`
        : 'В системе пока нет активных врачей для записи.',
      data: { action: 'doctors', doctors: [] },
    }
  }

  if (!wantsBooking) {
    const visible = doctors.slice(0, 8)
    return {
      functionName: 'get_doctors',
      message: `Нашёл врачей:\n${visible.map(formatDoctorLine).join('\n')}`,
      data: { action: 'doctors', doctors: visible, date },
    }
  }

  if (!date) {
    const visible = doctors.slice(0, 8)
    return {
      functionName: 'get_doctors',
      message: `Выберите врача для записи:\n${visible.map(formatDoctorLine).join('\n')}\n\nПосле выбора врача я предложу дату, а затем покажу свободные слоты.`,
      data: { action: 'doctors', doctors: visible, bookingFlow: true },
    }
  }

  const doctor = doctors[0]
  const slots = (await getAssistantSlots(doctor.id, date)).filter((slot) => slot.available)

  if (time) {
    const requestedAt = makeDateTime(date, time)
    const matchingSlot = slots.find((slot) => new Date(slot.time).getTime() === requestedAt.getTime())
    if (matchingSlot) {
      const pending = buildPendingBooking(doctor, matchingSlot.time, appointmentType)
      return {
        functionName: 'select_slot',
        message: `Могу записать к ${doctor.name} на ${formatMoscowDate(new Date(matchingSlot.time))} в ${matchingSlot.timeString}. Подтвердить запись?`,
        data: { action: 'booking_pending', doctors: [doctor], pendingBooking: pending },
      }
    }
  }

  const visibleSlots = slots.slice(0, 8)
  return {
    functionName: 'get_available_slots',
    message: visibleSlots.length
      ? `Свободное время у ${doctor.name} на ${formatMoscowDate(makeMoscowDateTime(date, '12:00'))}: ${visibleSlots.map((s) => s.timeString).join(', ')}. Выберите удобный слот.`
      : `На ${formatMoscowDate(makeMoscowDateTime(date, '12:00'))} у ${doctor.name} свободных слотов нет. Попробуйте другую дату.`,
    data: { action: 'slots', doctors: [doctor], slots: visibleSlots, date },
  }
}
