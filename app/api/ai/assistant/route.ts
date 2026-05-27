import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { classifyAssistantIntent } from '@/lib/ai/assistant-router'
import {
  isAnalysisDeepDiveRequest,
  isAnalysisListOnlyRequest,
  shouldBypassProjectActionShortcut,
} from '@/lib/ai/assistant-analysis-intent'
import {
  collectUserAbnormalIndicators,
  formatAbnormalIndicatorsForChat,
} from '@/lib/ai/assistant-abnormal-indicators'
import { toLegacyAssistantResponse } from '@/lib/ai/assistant-contract'
import { makeAssistantRequestId, logAssistantEvent } from '@/lib/ai/assistant-audit'
import { tryAssistantLlm } from '@/lib/ai/assistant-llm'
import { getAssistantToolDefinition } from '@/lib/ai/assistant-tools'
import { parse as parseCookies } from 'cookie'

// Использует headers/cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Определяем функции, которые может выполнять AI ассистент
const availableFunctions = {
  // Запись на прием
  book_appointment: {
    description: 'Записать пациента на прием к врачу',
    parameters: {
      type: 'object',
      properties: {
        doctorId: { type: 'string', description: 'ID врача' },
        appointmentType: { type: 'string', enum: ['consultation', 'follow_up', 'routine', 'emergency'], description: 'Тип приема' },
        date: { type: 'string', format: 'date', description: 'Дата приема в формате YYYY-MM-DD' },
        time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', description: 'Время приема в формате HH:MM' },
        notes: { type: 'string', description: 'Дополнительные заметки' }
      },
      required: ['doctorId', 'appointmentType', 'date', 'time']
    }
  },
  
  // Получение результатов анализов
  get_analysis_results: {
    description: 'Получить результаты анализов пациента',
    parameters: {
      type: 'object',
      properties: {
        analysisId: { type: 'string', description: 'ID конкретного анализа (опционально)' },
        category: { type: 'string', description: 'Категория анализов (опционально)' },
        limit: { type: 'number', description: 'Количество последних анализов (по умолчанию 5)' }
      }
    }
  },
  
  // Получение рекомендаций
  get_recommendations: {
    description: 'Получить персональные рекомендации для пациента',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Категория рекомендаций (опционально)' },
        limit: { type: 'number', description: 'Количество рекомендаций (по умолчанию 3)' }
      }
    }
  },
  
  // Получение списка врачей
  get_doctors: {
    description: 'Получить список доступных врачей',
    parameters: {
      type: 'object',
      properties: {
        specialization: { type: 'string', description: 'Специализация врача (опционально)' },
        available: { type: 'boolean', description: 'Только доступные для записи врачи' }
      }
    }
  },
  
  // Получение записей пациента
  get_appointments: {
    description: 'Получить записи пациента на приемы',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['scheduled', 'confirmed', 'completed', 'cancelled'], description: 'Статус записи (опционально)' },
        upcoming: { type: 'boolean', description: 'Только предстоящие записи' }
      }
    }
  }
}

type AssistantAction =
  | { type: 'select_doctor'; doctorId: string; date?: string | null }
  | { type: 'select_slot'; doctorId: string; scheduledAt: string }
  | { type: 'confirm_booking' }
  | { type: 'cancel_booking' }
  | { type: 'complete_task'; taskId: string }

type AssistantDoctor = {
  id: string
  name: string
  email?: string | null
  specialization: string
  experience?: number | null
  clinic?: string | null
  phone?: string | null
  consultationFee?: number | null
}

type AssistantSlot = {
  time: string
  timeString: string
  available: boolean
}

type PendingBooking = {
  doctorId: string
  doctorName: string
  specialization?: string | null
  scheduledAt: string
  timeString: string
  appointmentType: string
  notes?: string | null
}

export async function POST(request: NextRequest) {
  const requestId = makeAssistantRequestId()
  const startedAt = Date.now()
  try {
    logAssistantEvent('request_start', { requestId })
    logAssistantEvent('runtime_status', {
      requestId,
      llmConfigured: !!isOllamaConfigured(),
      isPrismaAvailable: !!prisma,
      hasDoctorProfileModel: !!prisma?.doctorProfile,
    })
    
    const { message, history, documentIds, ragScope, action, pendingBooking } = await request.json()
    logAssistantEvent('request_metadata', {
      requestId,
      hasHistory: !!history,
      documentIdsCount: Array.isArray(documentIds) ? documentIds.length : 0,
      ragScope: typeof ragScope === 'string' ? ragScope : 'default',
      hasAction: !!action,
    })

    if (!message || typeof message !== 'string') {
      console.log('[AI-ASSISTANT] Invalid message format')
      return NextResponse.json(
        { error: 'Сообщение обязательно' },
        { status: 400 }
      )
    }

    // Проверка авторизации (поддержка Bearer и Cookie)
    const auth = request.headers.get('authorization') || ''
    const bearerToken = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
    const cookieHeader = request.headers.get('cookie')
    const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
    const token = bearerToken || cookies.token
    console.log('[AI-ASSISTANT] Token check:', { hasToken: !!token, source: bearerToken ? 'bearer' : 'cookie' })

    if (!token) {
      console.log('[AI-ASSISTANT] No token found')
      return NextResponse.json(
        { error: 'Необходима авторизация' },
        { status: 401 }
      )
    }

    let payload
    try {
      payload = verifyToken(token)
      console.log('[AI-ASSISTANT] Token verified:', { hasPayload: !!payload, userId: payload?.userId })
    } catch (tokenError) {
      console.error('[AI-ASSISTANT] Token verification failed:', tokenError)
      return NextResponse.json(
        { error: 'Неверный токен' },
        { status: 401 }
      )
    }

    if (!payload?.userId) {
      console.log('[AI-ASSISTANT] Invalid payload')
      return NextResponse.json(
        { error: 'Неверный токен' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const intentDecision = classifyAssistantIntent(message)
    logAssistantEvent('intent_classified', {
      requestId,
      userId,
      intent: intentDecision.intent,
      confidence: intentDecision.confidence,
      reason: intentDecision.reason,
    })

    const normalizedDocumentIds: string[] =
      Array.isArray(documentIds) ? documentIds.filter((x) => typeof x === 'string' && x.trim().length > 0) : []

    const bypassShortcut = shouldBypassProjectActionShortcut(intentDecision.intent, message)
    const projectAction = bypassShortcut
      ? null
      : await handleProjectActionIntent({
          message,
          userId,
          action,
          pendingBooking,
          intent: intentDecision.intent,
        })

    if (projectAction) {
      const toolDefinition = getAssistantToolDefinition(projectAction.functionName)
      logAssistantEvent('tool_result', {
        requestId,
        userId,
        functionName: projectAction.functionName,
        risk: toolDefinition?.risk || 'read',
        requiresConfirmation: toolDefinition?.requiresConfirmation || false,
        action: projectAction.data?.action,
        latencyMs: Date.now() - startedAt,
      })
      return NextResponse.json(toLegacyAssistantResponse({
        text: projectAction.message,
        cards: projectAction.cards,
        actions: projectAction.actions,
        safety: projectAction.safety,
        requestId,
      }, {
        functionResult: projectAction.data,
        functionName: projectAction.functionName,
        timestamp: new Date().toISOString()
      }))
    }

    const effectiveRagScope: 'none' | 'attached' | 'patient_data' | 'app_knowledge' | 'marketplace' =
      ragScope === 'all'
        ? 'patient_data'
        : ragScope === 'patient_data' || ragScope === 'app_knowledge' || ragScope === 'marketplace' || ragScope === 'attached' || ragScope === 'none'
          ? ragScope
          : normalizedDocumentIds.length > 0
            ? 'attached'
            : intentDecision.intent === 'app_help' || intentDecision.intent === 'smalltalk'
              ? 'app_knowledge'
              : 'patient_data'

    // RAG режим: либо по прикрепленным документам, либо "по всем данным пользователя".
    // В RAG режиме не запускаем авто-функции (иначе вопросы уйдут в get_analysis_results и потеряем цитирование).
    if (effectiveRagScope !== 'none') {
      logAssistantEvent('rag_mode', { requestId, userId, effectiveRagScope })

      // Если запрос похож на "сделай план действий" — генерируем план и создаём напоминания.
      if (effectiveRagScope === 'attached' && normalizedDocumentIds.length > 0 && isCarePlanIntent(message)) {
        const planResult = await createCarePlanFromDocuments(userId, message, normalizedDocumentIds)
        return NextResponse.json({
          response: planResult.message,
          functionResult: planResult.data,
          functionName: 'create_care_plan',
          sources: planResult.sources,
          requestId,
          timestamp: new Date().toISOString()
        })
      }

      const aiResponse = await generateAIResponse(message, userId, history, normalizedDocumentIds, effectiveRagScope)
      return NextResponse.json({
        response: aiResponse.response,
        sources: aiResponse.sources,
        requestId,
        provider: (aiResponse as any).provider,
        timestamp: new Date().toISOString()
      })
    }

    // Анализируем сообщение и определяем, какую функцию вызвать
    logAssistantEvent('legacy_router_check', { requestId, userId })
    const functionCall = await analyzeMessageAndDetermineFunction(message, userId)
    logAssistantEvent('legacy_router_result', { requestId, userId, functionName: functionCall?.name || null })

    if (functionCall) {
      // Выполняем функцию
      const result = await executeFunction(functionCall, userId)

      return NextResponse.json({
        response: result.message,
        functionResult: result.data,
        functionName: functionCall.name,
        requestId,
        timestamp: new Date().toISOString()
      })
    }

    // Обычный AI ответ без функций
    logAssistantEvent('llm_response', { requestId, userId, effectiveRagScope: 'none' })
    const aiResponse = await generateAIResponse(message, userId, history, [], 'none')

    return NextResponse.json({
      response: aiResponse.response,
      sources: aiResponse.sources,
      requestId,
      provider: (aiResponse as any).provider,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[AI-ASSISTANT] error:', { requestId, message: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Ошибка обработки сообщения', requestId },
      { status: 500 }
    )
  }
}

function isCarePlanIntent(message: string) {
  const t = (message || '').toLowerCase()
  return (
    /план|пошагов|что делать дальше|следующие шаги|напоминан|reminder|задач/i.test(t) &&
    !/не делай|не создавай|без напоминаний/i.test(t)
  )
}

function isYesIntent(message: string) {
  return /^(да|ага|ок|okay|yes|подтверждаю|запиши|давай|согласен|согласна)([.! ]|$)/i.test(message.trim())
}

function isNoIntent(message: string) {
  return /^(нет|не надо|отмена|отмени|cancel|стоп)([.! ]|$)/i.test(message.trim())
}

function isDoctorIntent(message: string) {
  if (
    isAppointmentQueryIntent(message) ||
    isDiaryIntent(message) ||
    isMedicationsIntent(message) ||
    isCarePlanTasksIntent(message) ||
    isReminderIntent(message) ||
    isDocumentsIntent(message) ||
    isAnalysesListIntent(message)
  ) return false
  return /врач|доктор|специалист|терапевт|кардиолог|невролог|эндокринолог|при[её]м|запис/i.test(message)
}

function isBookingIntent(message: string) {
  return /запис|при[её]м|свободн|слот|время|расписан/i.test(message)
}

function isAppointmentQueryIntent(message: string) {
  const t = message.toLowerCase()
  if (/записаться|запиши|записать|найди.*врач|покажи.*врач|свободн.*слот|хочу.*при[её]м/i.test(t)) return false
  return (
    /(?:мои|мой|покажи|какие|когда|ближайш|предстоящ).*(?:запис[ьи]?|при[её]м[ы]?)/i.test(t) ||
    /(?:запис[ьи]?|при[её]м[ы]?).*(?:мои|предстоящ|ближайш)/i.test(t)
  )
}

function isReminderIntent(message: string) {
  return /напоминан|ремайндер|reminder/i.test(message)
}

function isDocumentsIntent(message: string) {
  return /(?:мои|покажи|список|последн).*(?:документ|файл|загрузк)|(?:документ|файл).*(?:мои|последн)/i.test(message)
}

function isAnalysesListIntent(message: string) {
  return /(?:мои|покажи|список|последн).*(?:анализ|показател)|(?:анализ|показател).*(?:мои|последн)/i.test(message)
}

function isDiaryIntent(message: string) {
  return /дневник|самочувств|настроен|сон|бол[ьи]|шаг|давлен|пульс|температур|симптом|вес|запис.*дневник/i.test(message)
}

function isAddDiaryIntent(message: string) {
  return /(добав|запиш|внес|отмет|сохран).*(дневник|запис|самочувств)/i.test(message) || hasDiaryMetrics(message)
}

function hasDiaryMetrics(message: string) {
  return /(?:боль|сон|настроен|давлен|пульс|шаг|температур|вес)\s*[:\s]*\d/i.test(message)
}

function isDiaryReviewIntent(message: string) {
  return /обзор|недел|итог|что влияло|корреляц/i.test(message) && isDiaryIntent(message)
}

function isMedicationsIntent(message: string) {
  return (
    /лекарств|препарат|таблетк|бад|медикамент|что принимаю|список.*лекарств|расписан.*при[её]м/i.test(message) &&
    !/рекомендац|совет.*леч/i.test(message)
  )
}

function isCarePlanTasksIntent(message: string) {
  const t = (message || '').toLowerCase()
  if (/планов.*при[её]м|плановый осмотр/i.test(t)) return false
  return (
    /план действий|мои задачи|задач|активн.*задач|отложен|выполнен|согласован|что сделать|следующ.*шаг/i.test(t) &&
    !/запис.*врач|слот|при[её]м к|к врачу/i.test(t)
  )
}

function isAddCarePlanTaskIntent(message: string) {
  return /(добав|создай|новая).*(задач)/i.test(message) || /задач[ауи]:\s*\S/i.test(message)
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
  const lines = [
    `Записей за 7 дней: ${entries.length}.`,
    mood != null ? `Среднее настроение: ${mood}/5.` : null,
    pain != null ? `Средняя боль: ${pain}/10.` : null,
    sleep != null ? `Средний сон: ${sleep} ч.` : null,
    'Подробный AI-обзор можно сформировать в «Дневник → Записи».',
  ].filter(Boolean)

  return { text: lines.join(' '), entries }
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
    const d = new Date()
    const word = dateMatch[4].toLowerCase()
    if (word === 'завтра') d.setDate(d.getDate() + 1)
    if (word === 'послезавтра') d.setDate(d.getDate() + 2)
    return d.toISOString().slice(0, 10)
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
  return new Date(`${date}T${time}:00`)
}

function formatSlotTime(date: Date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDateForSlotLookup(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function getAssistantSlots(doctorId: string, date: string): Promise<AssistantSlot[]> {
  const selectedDate = new Date(date)
  if (Number.isNaN(selectedDate.getTime())) return []

  const startOfDay = new Date(selectedDate)
  startOfDay.setHours(9, 0, 0, 0)

  const endOfDay = new Date(selectedDate)
  endOfDay.setHours(21, 0, 0, 0)

  const bookedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      scheduledAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
      status: {
        in: ['scheduled', 'confirmed'],
      },
    },
    select: { scheduledAt: true },
  })

  const booked = new Set(bookedAppointments.map((a) => new Date(a.scheduledAt).getTime()))
  const slots: AssistantSlot[] = []
  const current = new Date(startOfDay)
  const now = new Date()

  while (current < endOfDay) {
    if (current > now) {
      const isBooked = booked.has(current.getTime())
      slots.push({
        time: current.toISOString(),
        timeString: formatSlotTime(current),
        available: !isBooked,
      })
    }
    current.setMinutes(current.getMinutes() + 15)
  }

  return slots
}

async function getNextAssistantSlots(doctorId: string, daysAhead = 7, limit = 8) {
  const result: Array<AssistantSlot & { date: string }> = []
  const start = new Date()

  for (let offset = 0; offset < daysAhead && result.length < limit; offset += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + offset)
    const date = formatDateForSlotLookup(day)
    const slots = (await getAssistantSlots(doctorId, date)).filter((slot) => slot.available)
    for (const slot of slots) {
      result.push({ ...slot, date })
      if (result.length >= limit) break
    }
  }

  return result
}

function buildDateOptions(daysAhead = 7) {
  const start = new Date()
  return Array.from({ length: daysAhead }, (_, offset) => {
    const day = new Date(start)
    day.setDate(start.getDate() + offset)
    const date = formatDateForSlotLookup(day)
    const label =
      offset === 0
        ? 'Сегодня'
        : offset === 1
          ? 'Завтра'
          : day.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    return { date, label }
  })
}

function buildPendingBooking(doctor: AssistantDoctor, scheduledAt: string, appointmentType: string, notes?: string | null): PendingBooking {
  const date = new Date(scheduledAt)
  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialization: doctor.specialization,
    scheduledAt,
    timeString: formatSlotTime(date),
    appointmentType,
    notes: notes || null,
  }
}

function isPendingBooking(value: any): value is PendingBooking {
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

  const appointmentDate = new Date(pending.scheduledAt)
  if (Number.isNaN(appointmentDate.getTime())) throw new Error('Некорректное время записи')
  if (appointmentDate <= new Date()) throw new Error('Нельзя записаться на прошедшее время')

  const hour = appointmentDate.getHours()
  if (hour < 9 || hour >= 21) throw new Error('Запись возможна только с 9:00 до 21:00')

  const minutes = appointmentDate.getMinutes()
  if (minutes % 15 !== 0) throw new Error('Время записи должно быть кратно 15 минутам')

  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId: pending.doctorId,
      scheduledAt: appointmentDate,
      status: { in: ['scheduled', 'confirmed'] },
    }
  })

  if (existingAppointment) throw new Error('Это время уже занято')

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

async function handleProjectActionIntent(input: {
  message: string
  userId: string
  action?: AssistantAction
  pendingBooking?: PendingBooking
  intent?: string
}): Promise<{ message: string; data: any; functionName: string; cards?: any[]; actions?: any[]; safety?: any } | null> {
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
        message: `Запись создана: ${scheduledAt.toLocaleDateString('ru-RU')} в ${formatSlotTime(scheduledAt)}, врач ${appointment.doctor.user.name}. Она появится в разделе «Мои записи».`,
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
      message: `Подтвердите запись: ${doctor.name}, ${doctor.specialization}, ${date.toLocaleDateString('ru-RU')} в ${pending.timeString}. Записать?`,
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
        ? `Свободное время у ${doctor.name} на ${new Date(date).toLocaleDateString('ru-RU')}: ${slots.map((s) => s.timeString).join(', ')}. Выберите слот.`
        : `На ${new Date(date).toLocaleDateString('ru-RU')} у ${doctor.name} свободных слотов нет. Попробуйте другую дату.`,
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
        message: `Могу записать к ${doctor.name} на ${new Date(matchingSlot.time).toLocaleDateString('ru-RU')} в ${matchingSlot.timeString}. Подтвердить запись?`,
        data: { action: 'booking_pending', doctors: [doctor], pendingBooking: pending },
      }
    }
  }

  const visibleSlots = slots.slice(0, 8)
  return {
    functionName: 'get_available_slots',
    message: visibleSlots.length
      ? `Свободное время у ${doctor.name} на ${new Date(date).toLocaleDateString('ru-RU')}: ${visibleSlots.map((s) => s.timeString).join(', ')}. Выберите удобный слот.`
      : `На ${new Date(date).toLocaleDateString('ru-RU')} у ${doctor.name} свободных слотов нет. Попробуйте другую дату.`,
    data: { action: 'slots', doctors: [doctor], slots: visibleSlots, date },
  }
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {}
  // попытка вытащить JSON из ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1])
    } catch {}
  }
  // попытка вытащить первый объект/массив
  const brace = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (brace?.[1]) {
    try {
      return JSON.parse(brace[1])
    } catch {}
  }
  return null
}

function normalizeRecurrence(value: string) {
  const v = (value || '').toUpperCase()
  if (v === 'DAILY' || v === 'WEEKLY' || v === 'MONTHLY' || v === 'YEARLY' || v === 'NONE') return v
  return 'NONE'
}

function normalizeChannels(channels: any): string[] {
  const allowed = new Set(['EMAIL', 'PUSH', 'SMS'])
  if (!Array.isArray(channels)) return ['PUSH']
  const out = channels.map((c) => String(c).toUpperCase()).filter((c) => allowed.has(c))
  return out.length > 0 ? out : ['PUSH']
}

async function createCarePlanFromDocuments(userId: string, message: string, documentIds: string[]) {
  const rag = await buildRagContext(userId, message, documentIds)

  const ollamaReady = isOllamaConfigured()
  if (!ollamaReady) {
    return {
      message:
        'AI отключён (OLLAMA_DISABLED=true). Запустите Ollama: `ollama serve`, установите модель: `ollama pull llama3.2`, перезапустите `npm run dev`.',
      data: null,
      sources: rag.sources
    }
  }

  const systemPrompt = `Ты — медицинский ассистент.
Сформируй план действий по прикрепленным медицинским документам.

ВАЖНО:
- Не ставь диагнозы.
- Если данных недостаточно — укажи, какие данные нужны.
- План должен быть практичным: что сделать, когда, к кому обратиться.

ОТВЕЧАЙ СТРОГО В JSON (без текста вокруг):
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "dueInDays": 0,
      "recurrence": "NONE|DAILY|WEEKLY|MONTHLY|YEARLY",
      "channels": ["PUSH","EMAIL","SMS"]
    }
  ]
}

Ограничения:
- tasks: 3..7
- dueInDays: 0..90
- channels: минимум 1`

  const userBlock = `ДАННЫЕ ИЗ ДОКУМЕНТОВ:\n${rag.contextText}\n\nЗапрос пользователя: ${message}`

  let text: string
  try {
    text = await callOllamaChat({
      system: systemPrompt,
      user: userBlock,
      temperature: 0.2,
      responseFormat: { type: 'json_object' }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      message:
        'Не удалось получить ответ от Ollama для плана действий. Проверьте `ollama serve` и модель: `ollama pull llama3.2`.',
      data: { error: msg },
      sources: rag.sources
    }
  }

  const parsed = safeJsonParse(text)
  const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : []
  if (tasks.length === 0) {
    return {
      message: 'AI не смог сформировать структурированный план. Попробуйте уточнить запрос (например: "сделай план на 2 недели").',
      data: { raw: text },
      sources: rag.sources
    }
  }

  const now = Date.now()
  const created: any[] = []
  const docIdForLink = documentIds[0] || null

  for (const t of tasks.slice(0, 7)) {
    const title = String(t.title || '').trim()
    if (!title) continue
    const description = String(t.description || '').trim() || null
    const dueInDaysNum = Math.max(0, Math.min(90, Number(t.dueInDays ?? 0) || 0))
    const dueAt = new Date(now + dueInDaysNum * 24 * 60 * 60 * 1000)
    const recurrence = normalizeRecurrence(t.recurrence)
    const channels = normalizeChannels(t.channels)

    const reminder = await prisma.reminder.create({
      data: {
        userId,
        title,
        description,
        dueAt,
        recurrence,
        channels,
        documentId: docIdForLink
      }
    })
    created.push(reminder)
  }

  const summary =
    created.length > 0
      ? `Сформировал план и создал ${created.length} напоминаний. Откройте раздел “Напоминания”, чтобы управлять ими.`
      : 'План сформирован, но напоминания создать не удалось (проверьте данные и попробуйте снова).'

  return {
    message: summary,
    data: { reminders: created, raw: parsed },
    sources: rag.sources
  }
}

// Анализ сообщения и определение нужной функции
async function analyzeMessageAndDetermineFunction(message: string, userId: string) {
  const lowerMessage = message.toLowerCase()
  
  // Запись на прием - сначала показываем список врачей
  if (lowerMessage.match(/записать|записаться|запись.*прием|прием.*врач|когда.*врач/) && 
      !lowerMessage.match(/\d{1,2}:\d{2}/) && // Нет времени
      !lowerMessage.match(/\d{1,2}[.\-/]\d{1,2}/)) { // Нет даты
    // Если нет конкретной даты/времени, показываем список врачей
    return {
      name: 'get_doctors',
      parameters: await extractDoctorParameters(message)
    }
  }
  
  // Запись на прием с конкретными параметрами
  if (lowerMessage.match(/записать|записаться|запись.*прием/) && 
      (lowerMessage.match(/\d{1,2}:\d{2}/) || lowerMessage.match(/\d{1,2}[.\-/]\d{1,2}/))) {
    return {
      name: 'book_appointment',
      parameters: await extractAppointmentParameters(message, userId)
    }
  }
  
  // Результаты анализов
  if (lowerMessage.match(/анализ|результат|показатель|лабораторн|кровь|моча|биохимия/)) {
    return {
      name: 'get_analysis_results',
      parameters: await extractAnalysisParameters(message)
    }
  }
  
  // Рекомендации
  if (lowerMessage.match(/рекомендац|совет|что.*делать|как.*лечить|диета|упражнен/)) {
    return {
      name: 'get_recommendations',
      parameters: await extractRecommendationParameters(message)
    }
  }
  
  // Список врачей
  if (lowerMessage.match(/врач|доктор|специалист|кто.*лечит|какой.*врач/)) {
    return {
      name: 'get_doctors',
      parameters: await extractDoctorParameters(message)
    }
  }
  
  // Записи на приемы
  if (lowerMessage.match(/мои.*записи|прием|расписание|когда.*прием/)) {
    return {
      name: 'get_appointments',
      parameters: await extractAppointmentQueryParameters(message)
    }
  }
  
  return null
}

// Извлечение параметров для записи на прием
async function extractAppointmentParameters(message: string, userId: string) {
  const params: any = {}
  
  // Попытка извлечь дату
  const dateMatch = message.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?|(завтра|послезавтра|сегодня)/)
  if (dateMatch) {
    if (dateMatch[4]) {
      // Относительная дата (завтра, послезавтра, сегодня)
      const today = new Date()
      if (dateMatch[4] === 'завтра') {
        today.setDate(today.getDate() + 1)
      } else if (dateMatch[4] === 'послезавтра') {
        today.setDate(today.getDate() + 2)
      }
      params.date = today.toISOString().split('T')[0]
    } else if (dateMatch[1] && dateMatch[2]) {
      // Конкретная дата (дд.мм или дд.мм.гггг)
      const day = dateMatch[1].padStart(2, '0')
      const month = dateMatch[2].padStart(2, '0')
      const year = dateMatch[3] || new Date().getFullYear().toString()
      params.date = `${year.length === 2 ? '20' + year : year}-${month}-${day}`
    }
  } else {
    params.date = new Date().toISOString().split('T')[0]
  }
  
  // Попытка извлечь время
  const timeMatch = message.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    params.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
  } else {
    params.time = '10:00' // По умолчанию
  }
  
  // Тип приема
  if (message.match(/консультац/i)) {
    params.appointmentType = 'consultation'
  } else if (message.match(/повторн|контрольн/i)) {
    params.appointmentType = 'follow_up'
  } else if (message.match(/планов|профилактич/i)) {
    params.appointmentType = 'routine'
  } else if (message.match(/срочн|экстрен/i)) {
    params.appointmentType = 'emergency'
  } else {
    params.appointmentType = 'consultation'
  }
  
  // Попытка извлечь ФИО врача из сообщения
  try {
    // Ищем паттерны типа "к [ФИО]" или "врачу [ФИО]"
    const doctorNameMatch = message.match(/(?:к|врачу)\s+([А-ЯЁа-яё]+(?:\s+[А-ЯЁа-яё]+){1,3})/i)
    
    if (doctorNameMatch) {
      const doctorName = doctorNameMatch[1].trim()
      console.log('[AI-ASSISTANT] Searching for doctor by name:', doctorName)
      
      // Ищем врача по имени (частичное совпадение)
      const doctors = await prisma.doctorProfile.findMany({
        include: { user: true },
        take: 10
      })
      
      const foundDoctor = doctors.find(d => 
        d.user.name.toLowerCase().includes(doctorName.toLowerCase()) ||
        doctorName.toLowerCase().includes(d.user.name.toLowerCase())
      )
      
      if (foundDoctor) {
        params.doctorId = foundDoctor.id
        console.log('[AI-ASSISTANT] Doctor found by name:', foundDoctor.user.name)
      } else {
        console.log('[AI-ASSISTANT] Doctor not found by name, using first available')
        // Если не нашли по имени, берем первого доступного
        if (doctors.length > 0) {
          params.doctorId = doctors[0].id
        }
      }
    } else {
      // Если ФИО не указано, берем первого доступного врача
      const doctors = await prisma.doctorProfile.findMany({
        include: { user: true },
        take: 1
      })
      
      if (doctors.length > 0) {
        params.doctorId = doctors[0].id
      }
    }
  } catch (dbError) {
    console.error('[AI-ASSISTANT] Database error in extractAppointmentParameters:', dbError)
    // Продолжаем без doctorId, функция bookAppointment обработает это
  }
  
  return params
}

// Извлечение параметров для анализов
async function extractAnalysisParameters(message: string) {
  const params: any = {}
  
  if (message.match(/кровь|общий.*анализ/i)) {
    params.category = 'blood'
  } else if (message.match(/моча/i)) {
    params.category = 'urine'
  } else if (message.match(/биохимия/i)) {
    params.category = 'biochemistry'
  }
  
  const limitMatch = message.match(/последн(ие|их)?\s*(\d+)/)
  if (limitMatch) {
    params.limit = parseInt(limitMatch[2])
  } else {
    params.limit = 5
  }
  
  return params
}

// Извлечение параметров для рекомендаций
async function extractRecommendationParameters(message: string) {
  const params: any = {}
  
  if (message.match(/питан|диет/i)) {
    params.category = 'nutrition'
  } else if (message.match(/физическ|спорт|упражнен/i)) {
    params.category = 'exercise'
  } else if (message.match(/лекарств|препарат/i)) {
    params.category = 'medication'
  }
  
  const limitMatch = message.match(/(\d+).*рекомендац/)
  if (limitMatch) {
    params.limit = parseInt(limitMatch[1])
  } else {
    params.limit = 3
  }
  
  return params
}

// Извлечение параметров для врачей
async function extractDoctorParameters(message: string) {
  const params: any = {}
  
  if (message.match(/терапевт|семейн/i)) {
    params.specialization = 'Терапевт'
  } else if (message.match(/кардиолог|сердц/i)) {
    params.specialization = 'Кардиолог'
  } else if (message.match(/невролог|головн/i)) {
    params.specialization = 'Невролог'
  } else if (message.match(/эндокринолог|диабет/i)) {
    params.specialization = 'Эндокринолог'
  }
  
  if (message.match(/доступн|свободн/i)) {
    params.available = true
  }
  
  return params
}

// Извлечение параметров для запросов записей
async function extractAppointmentQueryParameters(message: string) {
  const params: any = {}
  
  if (message.match(/предстоящ|ближайш|будущ/i)) {
    params.upcoming = true
  } else if (message.match(/отменен/i)) {
    params.status = 'cancelled'
  } else if (message.match(/завершен|прошедш/i)) {
    params.status = 'completed'
  }
  
  return params
}

// Выполнение функций
async function executeFunction(functionCall: any, userId: string) {
  try {
    switch (functionCall.name) {
      case 'book_appointment':
        return await bookAppointment(functionCall.parameters, userId)
      
      case 'get_analysis_results':
        return await getAnalysisResults(functionCall.parameters, userId)
      
      case 'get_recommendations':
        return await getRecommendations(functionCall.parameters, userId)
      
      case 'get_doctors':
        return await getDoctors(functionCall.parameters)
      
      case 'get_appointments':
        return await getAppointments(functionCall.parameters, userId)
      
      default:
        return {
          message: 'Извините, я не понимаю, что вы хотите сделать.',
          data: null
        }
    }
  } catch (error) {
    console.error(`Error executing function ${functionCall.name}:`, error)
    return {
      message: 'Произошла ошибка при выполнении запроса. Попробуйте еще раз.',
      data: null
    }
  }
}

// Функция записи на прием
async function bookAppointment(params: any, userId: string) {
  try {
    console.log('[AI-ASSISTANT] bookAppointment called with params:', params)
    console.log('[AI-ASSISTANT] Prisma availability check:', { 
      hasPrisma: !!prisma,
      hasDoctorProfileModel: !!prisma?.doctorProfile,
      doctorProfileModelType: typeof prisma?.doctorProfile
    })
    
    if (!prisma || !prisma.doctorProfile) {
      throw new Error('Prisma client not initialized properly')
    }
    
    const { doctorId, appointmentType, date, time, notes } = params
    
    // Проверяем, что врач существует
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: true }
    })
    console.log('[AI-ASSISTANT] Doctor found:', !!doctor)
    
    if (!doctorId) {
      return {
        message: '⚠️ В системе пока нет зарегистрированных врачей.\n\n💡 Чтобы записаться на прием:\n1. Администратор должен создать учетную запись врача через Prisma Studio (http://localhost:5555)\n2. Или позвоните в регистратуру для записи\n\n📞 Телефон регистратуры: +7 (999) 123-45-67\n\n🔧 Для администратора:\n• Откройте http://localhost:5555\n• Создайте пользователя с ролью DOCTOR\n• Создайте запись в таблице DoctorProfile с userId этого пользователя',
        data: null
      }
    }

    if (!doctor) {
      return {
        message: '⚠️ Указанный врач не найден в системе.\n\nПопробуйте:\n• "Покажи список врачей"\n• "Найди терапевта"\n• Или позвоните в регистратуру для записи',
        data: null
      }
    }
    
    // Получаем информацию о пациенте
    const patient = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!patient) {
      return {
        message: '⚠️ Не удалось найти информацию о пациенте.',
        data: null
      }
    }
    
    // Создаем запись на прием
    const scheduledAt = new Date(`${date}T${time}:00`)
    
    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId: userId,
        patientName: patient.name,
        patientEmail: patient.email,
        appointmentType,
        scheduledAt,
        duration: 30,
        status: 'scheduled',
        notes
      },
      include: {
        doctor: {
          include: { user: true }
        }
      }
    })
    
    return {
      message: `✅ Запись на прием успешно создана!\n\n📅 Дата: ${scheduledAt.toLocaleDateString('ru-RU')}\n🕐 Время: ${scheduledAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n👨‍⚕️ Врач: ${doctor.user.name}\n📋 Тип: ${getAppointmentTypeLabel(appointmentType)}`,
      data: appointment
    }
  } catch (error) {
    console.error('[AI-ASSISTANT] Error in bookAppointment:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('Unique constraint')) {
      return {
        message: '⚠️ Выбранное время уже занято.\n\nПопробуйте:\n• Выбрать другое время\n• "Покажи свободные слоты на завтра"\n• Позвонить в регистратуру для уточнения расписания',
        data: null
      }
    }
    
    return {
      message: `⚠️ Не удалось создать запись на прием.\n\n🔍 Причина: ${errorMessage}\n\n💡 Попробуйте:\n• Указать конкретную дату и время\n• Проверить, что врач доступен\n• Позвонить в регистратуру`,
      data: null
    }
  }
}

// Функция получения результатов анализов
async function getAnalysisResults(params: any, userId: string) {
  try {
    const { category, limit = 5 } = params
    
    let whereClause: any = { userId }
    
    if (category) {
      whereClause.category = category
    }
    
    const analyses = await prisma.analysis.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    
    if (analyses.length === 0) {
      return {
        message: 'У вас пока нет результатов анализов. Загрузите их в разделе "Документы".',
        data: null
      }
    }
    
    let message = `📊 Ваши результаты анализов:\n\n`
    
    analyses.forEach((analysis, index) => {
      message += `${index + 1}. ${analysis.title || 'Анализ'}\n`
      message += `   📅 Дата: ${new Date(analysis.createdAt).toLocaleDateString('ru-RU')}\n`
      
      if (analysis.results) {
        try {
          const results = JSON.parse(analysis.results)
          if (results.indicators && results.indicators.length > 0) {
            message += `   📈 Показатели:\n`
            results.indicators.slice(0, 3).forEach((indicator: any) => {
              const status = indicator.isNormal ? '✅' : '❌'
              message += `      • ${indicator.name}: ${indicator.value} ${indicator.unit || ''} ${status}\n`
            })
            if (results.indicators.length > 3) {
              message += `      • ... и еще ${results.indicators.length - 3} показателей\n`
            }
          }
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
      message += `\n`
    })
    
    return {
      message,
      data: analyses
    }
  } catch (error) {
    return {
      message: 'Не удалось получить результаты анализов.',
      data: null
    }
  }
}

// Функция получения рекомендаций
async function getRecommendations(params: any, userId: string) {
  try {
    const { category, limit = 3 } = params
    
    let whereClause: any = { status: 'ACTIVE' }
    
    if (category) {
      whereClause.category = category
    }
    
    const recommendations = await prisma.recommendation.findMany({
      where: whereClause,
      orderBy: { priority: 'desc' },
      take: limit
    })
    
    if (recommendations.length === 0) {
      return {
        message: 'Сейчас нет персональных рекомендаций. Проверьте раздел "Рекомендации" для общих советов по здоровью.',
        data: null
      }
    }
    
    let message = `💡 Персональные рекомендации:\n\n`
    
    recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec.title}\n`
      message += `   📝 ${rec.description}\n`
      if (rec.type) {
        message += `   🏷️ Тип: ${rec.type}\n`
      }
      message += `\n`
    })
    
    return {
      message,
      data: recommendations
    }
  } catch (error) {
    return {
      message: 'Не удалось получить рекомендации.',
      data: null
    }
  }
}

// Функция получения списка врачей
async function getDoctors(params: any) {
  try {
    const { specialization, available } = params
    
    let whereClause: any = {}
    
    if (specialization) {
      // SQLite не поддерживает mode: 'insensitive', используем обычный contains
      whereClause.specialization = {
        contains: specialization
      }
    }
    
    const doctors = await prisma.doctorProfile.findMany({
      where: whereClause,
      include: { user: true },
      take: 10
    })
    
    if (doctors.length === 0) {
      return {
        message: 'Врачи не найдены. Попробуйте изменить критерии поиска.',
        data: null
      }
    }
    
    let message = `👨‍⚕️ Доступные врачи:\n\n`
    
    doctors.forEach((doctor, index) => {
      message += `${index + 1}. **${doctor.user.name}**\n`
      message += `   🏥 Специализация: ${doctor.specialization}\n`
      if (doctor.phone) {
        message += `   📞 Телефон: ${doctor.phone}\n`
      }
      message += `\n`
    })
    
    message += `\n📅 Для записи на прием напишите:\n`
    message += `"Запиши меня к [ФИО врача] на [дата] в [время]"\n\n`
    message += `Например:\n`
    message += `• "Запиши меня к ${doctors[0].user.name} на завтра в 14:00"\n`
    message += `• "Запиши меня к ${doctors[0].user.name} на 10.10 в 10:00"\n`
    message += `• "Запиши меня к ${doctors[0].user.name} на послезавтра в 15:30"`
    
    return {
      message,
      data: doctors
    }
  } catch (error) {
    return {
      message: 'Не удалось получить список врачей.',
      data: null
    }
  }
}

// Функция получения записей на приемы
async function getAppointments(params: any, userId: string) {
  try {
    const { status, upcoming } = params
    
    let whereClause: any = { patientId: userId }
    
    if (status) {
      whereClause.status = status
    }
    
    if (upcoming) {
      whereClause.scheduledAt = {
        gte: new Date()
      }
    }
    
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        doctor: {
          include: { user: true }
        }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10
    })
    
    if (appointments.length === 0) {
      return {
        message: upcoming ? 'У вас нет предстоящих записей на приемы.' : 'У вас нет записей на приемы.',
        data: null
      }
    }
    
    let message = `📅 Ваши записи на приемы:\n\n`
    
    appointments.forEach((appointment, index) => {
      message += `${index + 1}. ${appointment.doctor.user.name}\n`
      message += `   📅 Дата: ${new Date(appointment.scheduledAt).toLocaleDateString('ru-RU')}\n`
      message += `   🕐 Время: ${new Date(appointment.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`
      message += `   📋 Тип: ${getAppointmentTypeLabel(appointment.appointmentType)}\n`
      message += `   📊 Статус: ${getStatusLabel(appointment.status)}\n`
      if (appointment.notes) {
        message += `   📝 Заметки: ${appointment.notes}\n`
      }
      message += `\n`
    })
    
    return {
      message,
      data: appointments
    }
  } catch (error) {
    return {
      message: 'Не удалось получить записи на приемы.',
      data: null
    }
  }
}

type RagSource = {
  sourceType: 'document' | 'analysis' | 'diary' | 'knowledge'
  id: string
  label: string
  date?: string | null
  url?: string | null
  snippet?: string

  // legacy fields (kept for backwards compatibility in some fallbacks)
  documentId?: string
  fileName?: string
  studyType?: string | null
  studyDate?: string | null
}

type AiResponseWithSources = {
  response: string
  sources: RagSource[]
  provider?: string
  model?: string
  latencyMs?: number
}

function buildAssistantSystemPrompt() {
  return `Ты — полнофункциональный AI-чат приложения «Персональный медицинский ассистент» (PMA).

Ты отвечаешь на русском языке. У тебя есть доступ к данным личного кабинета пользователя (блоки SOURCE): анализы с показателями, документы, дневник, профиль. Ты можешь и должен разбирать их по запросу — не отказывайся от разбора анализов, отклонений и динамики, если данные есть в SOURCE.

Разделы приложения:
- «Документы»: загрузка медицинских документов и анализов.
- «Анализы»: распознанные анализы, показатели, сравнение, динамика.
- «Дневник»: самочувствие, лекарства, план задач.
- «Напоминания», «Мои записи», «Маркетплейс».

Правила безопасности:
- Не ставь окончательные диагнозы и не назначай лечение (дозы, препараты).
- При красных флагах — рекомендуй врача или неотложную помощь.
- Не выдумывай анализы, цифры, записи или врачей — только SOURCE и профиль.

Работа с данными:
- Если пользователь просит «только отклонения» / «вне нормы» — перечисли только показатели с ⚠️ или явно вне референса, без полного списка всех анализов.
- Если просит «разбор», «что значит», «интерпретацию» — дай структурированный разбор по SOURCE: вывод, возможные причины, что пересдать/обсудить с врачом.
- Если SOURCE пуст — скажи, что данных нет, и подскажи загрузить документ в «Документы».
- Не пиши «в чате нельзя» или «я не могу анализировать» — ты как раз для этого и предназначен.

Формат:
- По делу, с подзаголовками при длинном ответе.
- Для навигации по приложению — конкретный путь (например «Анализы → Сравнить»).
- Для медицины: вывод → детали по показателям → что проверить → когда к врачу.`
}

function normalizeForSearch(input: string) {
  return (input || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(input: string) {
  const norm = normalizeForSearch(input)
  if (!norm) return []
  return norm.split(' ').filter((t) => t.length >= 2)
}

function splitIntoChunks(text: string, chunkSize = 900, overlap = 120) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const chunks: string[] = []
  let i = 0
  while (i < clean.length) {
    const end = Math.min(clean.length, i + chunkSize)
    chunks.push(clean.slice(i, end))
    if (end === clean.length) break
    i = Math.max(0, end - overlap)
  }
  return chunks
}

function sanitizeRagSnippet(text: string) {
  return (text || '')
    .replace(/```[\s\S]*?```/g, '[code block omitted]')
    .replace(/(?:ignore|forget|disregard)\s+(?:previous|all|system|developer)\s+instructions/gi, '[possible prompt-injection removed]')
    .replace(/(?:игнорируй|забудь|отмени)\s+(?:предыдущие|системные|инструкции)/gi, '[possible prompt-injection removed]')
    .slice(0, 1600)
}

function scoreChunk(queryTokens: string[], chunkText: string, opts?: { boostAbnormal?: boolean }) {
  const t = normalizeForSearch(chunkText)
  if (!t) return 0
  let score = 0
  for (const q of queryTokens) {
    if (t.includes(q)) score += 2
  }
  if (opts?.boostAbnormal && (t.includes('⚠️') || /вне норм|не в норм|isnormal.*false/i.test(t))) {
    score += 6
  }
  return score
}

function formatIndicatorsForPrompt(indicators: any) {
  if (!Array.isArray(indicators) || indicators.length === 0) return ''
  const lines: string[] = []
  for (const i of indicators.slice(0, 80)) {
    if (!i || typeof i !== 'object') continue
    const name = i.name ?? i.shortName ?? 'Показатель'
    const value = i.value ?? '—'
    const unit = i.unit ? ` ${i.unit}` : ''
    const refMin = i.referenceMin ?? null
    const refMax = i.referenceMax ?? null
    const ref =
      refMin !== null || refMax !== null ? ` (норма: ${refMin ?? '—'}–${refMax ?? '—'})` : ''
    const flag = i.isNormal === false ? ' ⚠️' : i.isNormal === true ? ' ✅' : ''
    lines.push(`- ${name}: ${value}${unit}${ref}${flag}`)
  }
  return lines.join('\n')
}

async function buildRagContext(userId: string, message: string, documentIds: string[]) {
  const docs = await prisma.document.findMany({
    where: {
      userId,
      id: { in: documentIds }
    },
    select: {
      id: true,
      fileName: true,
      uploadDate: true,
      studyDate: true,
      studyType: true,
      laboratory: true,
      doctor: true,
      findings: true,
      rawText: true,
      indicators: true
    }
  })

  const queryTokens = tokenize(message)
  const scored: Array<{ score: number; docId: string; docMeta: any; snippet: string }> = []

  for (const d of docs) {
    const baseTextParts: string[] = []
    if (d.findings) baseTextParts.push(String(d.findings))
    if (d.rawText) baseTextParts.push(String(d.rawText))
    const indicatorText = formatIndicatorsForPrompt(d.indicators)
    if (indicatorText) baseTextParts.push(indicatorText)
    const fullText = baseTextParts.join('\n')
    const chunks = splitIntoChunks(fullText, 900, 120)
    for (const c of chunks) {
      const s = scoreChunk(queryTokens, c)
      if (s > 0) {
        scored.push({ score: s, docId: d.id, docMeta: d, snippet: c })
      }
    }
    // fallback: если совпадений нет, добавляем короткий фрагмент, чтобы AI видел документ
    if (queryTokens.length > 0 && scored.filter((x) => x.docId === d.id).length === 0) {
      const fallback = (d.findings || indicatorText || d.rawText || '').toString().slice(0, 900)
      if (fallback) scored.push({ score: 1, docId: d.id, docMeta: d, snippet: fallback })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  // Важно: дедуп по документу. Иначе если один документ дал несколько релевантных чанков,
  // в UI будут дублироваться одинаковые "источники".
  const top: typeof scored = []
  const seenDoc = new Set<string>()
  for (const x of scored) {
    if (top.length >= 6) break
    if (seenDoc.has(x.docId)) continue
    seenDoc.add(x.docId)
    top.push(x)
  }

  const sources: RagSource[] = top.map((x) => ({
    sourceType: 'document',
    id: x.docId,
    label: x.docMeta.fileName,
    date: (x.docMeta.studyDate ?? x.docMeta.uploadDate)?.toISOString?.() ?? null,
    url: `/documents/${x.docId}`,
    snippet: x.snippet,
    documentId: x.docId,
    fileName: x.docMeta.fileName,
    studyType: x.docMeta.studyType ?? null,
    studyDate: (x.docMeta.studyDate ?? x.docMeta.uploadDate)?.toISOString?.() ?? null
  }))

  const promptBlocks = top.map((x, idx) => {
    const meta = x.docMeta
    const dateStr = meta.studyDate ?? meta.uploadDate
      ? new Date(meta.studyDate ?? meta.uploadDate).toLocaleDateString('ru-RU')
      : '—'
    const header = `[SOURCE ${idx + 1}] (DOCUMENT) ${meta.fileName}; Тип: ${meta.studyType ?? '—'}; Дата: ${dateStr}; Лаб: ${meta.laboratory ?? '—'}; URL: /documents/${x.docId}`
    return `${header}\n${sanitizeRagSnippet(x.snippet)}`
  })

  return {
    sources,
    contextText: promptBlocks.join('\n\n')
  }
}

async function buildAllUserRagContext(userId: string, message: string) {
  const queryTokens = tokenize(message)
  const wantsMedicalDeep = isAnalysisDeepDiveRequest(message)
  const wantsDeviations = /отклон|вне\s*норм|не\s*в\s*норм/i.test(normalizeForSearch(message))
  const boostAbnormal = wantsDeviations || wantsMedicalDeep

  const [docs, analyses, diary, kbIndicators, abnormalRows] = await Promise.all([
    prisma.document.findMany({
      where: { userId },
      orderBy: { uploadDate: 'desc' },
      take: 40,
      select: {
        id: true,
        fileName: true,
        uploadDate: true,
        studyDate: true,
        studyType: true,
        laboratory: true,
        doctor: true,
        findings: true,
        rawText: true,
        indicators: true
      }
    }),
    prisma.analysis.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 60,
      select: { id: true, title: true, type: true, date: true, status: true, results: true, notes: true }
    }),
    prisma.healthDiaryEntry.findMany({
      where: { userId },
      orderBy: { entryDate: 'desc' },
      take: 90,
      select: {
        id: true,
        entryDate: true,
        mood: true,
        painScore: true,
        sleepHours: true,
        steps: true,
        temperature: true,
        weight: true,
        systolic: true,
        diastolic: true,
        pulse: true,
        symptoms: true,
        notes: true
      }
    }),
    (async () => {
      const toks = queryTokens.slice(0, 6)
      if (toks.length === 0) return []
      // SQLite не поддерживает mode: 'insensitive', используем обычный contains
      // В SQLite поиск по умолчанию case-insensitive для большинства операций
      const OR: any[] = []
      for (const t of toks) {
        OR.push({ name: { contains: t } })
        OR.push({ shortName: { contains: t } })
        OR.push({ description: { contains: t } })
        OR.push({ increasedMeaning: { contains: t } })
        OR.push({ decreasedMeaning: { contains: t } })
      }
      try {
        return await prisma.indicator.findMany({
          where: { OR, isActive: true },
          take: 18,
          select: {
            id: true,
            name: true,
            shortName: true,
            unit: true,
            description: true,
            increasedMeaning: true,
            decreasedMeaning: true,
            maintenanceRecommendations: true,
            improvementRecommendations: true
          }
        })
      } catch (error) {
        // Если модель Indicator не существует или есть другие проблемы - возвращаем пустой массив
        console.error('[AI-ASSISTANT] Error fetching indicators:', error)
        return []
      }
    })(),
    boostAbnormal ? collectUserAbnormalIndicators(userId) : Promise.resolve([]),
  ])

  const scored: Array<{ score: number; source: RagSource; snippet: string }> = []

  if (abnormalRows.length > 0) {
    const summary = formatAbnormalIndicatorsForChat(abnormalRows)
    scored.push({
      score: 100,
      source: {
        sourceType: 'analysis',
        id: 'abnormal-summary',
        label: 'Сводка: показатели вне нормы',
        date: null,
        url: '/analyses',
        snippet: summary,
      },
      snippet: summary,
    })
  }

  // documents
  for (const d of docs) {
    const baseTextParts: string[] = []
    if (d.findings) baseTextParts.push(String(d.findings))
    if (d.rawText) baseTextParts.push(String(d.rawText))
    const indicatorText = formatIndicatorsForPrompt(d.indicators)
    if (indicatorText) baseTextParts.push(indicatorText)
    const fullText = baseTextParts.join('\n')
    const chunks = splitIntoChunks(fullText, 900, 120)
    for (const c of chunks) {
      const s = scoreChunk(queryTokens, c)
      if (s > 0) {
        scored.push({
          score: s + 1,
          source: {
            sourceType: 'document',
            id: d.id,
            label: d.fileName,
            date: (d.studyDate ?? d.uploadDate)?.toISOString?.() ?? null,
            url: `/documents/${d.id}`,
            snippet: c,
            documentId: d.id,
            fileName: d.fileName,
            studyType: d.studyType ?? null,
            studyDate: (d.studyDate ?? d.uploadDate)?.toISOString?.() ?? null
          },
          snippet: c
        })
      }
    }
  }

  // analyses
  for (let ai = 0; ai < analyses.length; ai++) {
    const a = analyses[ai]
    let parsed: any = null
    try {
      parsed = a?.results ? JSON.parse(a.results as unknown as string) : null
    } catch {
      parsed = null
    }
    const inds = Array.isArray(parsed?.indicators) ? parsed.indicators : []
    const indsText = formatIndicatorsForPrompt(inds)
    const notes = a.notes ? String(a.notes) : ''
    const header = `Анализ: ${a.title}; Тип: ${a.type}; Дата: ${(a.date as unknown as Date).toISOString().slice(0, 10)}; Статус: ${a.status}; URL: /analyses/${a.id}`
    const fullText = [header, indsText, notes].filter(Boolean).join('\n')
    const chunks = splitIntoChunks(fullText, 900, 120)
    for (const c of chunks) {
      let s = scoreChunk(queryTokens, c, { boostAbnormal })
      if (wantsMedicalDeep && s === 0 && ai < 10) s = 1
      if (s > 0) {
        scored.push({
          score: s + 2,
          source: {
            sourceType: 'analysis',
            id: a.id,
            label: a.title,
            date: (a.date as unknown as Date).toISOString?.() ?? null,
            url: `/analyses/${a.id}`,
            snippet: c
          },
          snippet: c
        })
      }
    }
  }

  // diary
  for (const e of diary) {
    const dateIso = (e.entryDate as unknown as Date).toISOString?.() ?? null
    const lines: string[] = []
    lines.push(`Дневник: ${(e.entryDate as unknown as Date).toISOString().slice(0, 10)}`)
    if (e.symptoms) lines.push(`Симптомы: ${e.symptoms}`)
    if (e.notes) lines.push(`Заметки: ${e.notes}`)
    const vitals: string[] = []
    if (typeof e.sleepHours === 'number') vitals.push(`сон ${e.sleepHours}ч`)
    if (typeof e.steps === 'number') vitals.push(`шаги ${e.steps}`)
    if (typeof e.temperature === 'number') vitals.push(`t ${e.temperature}`)
    if (typeof e.weight === 'number') vitals.push(`вес ${e.weight}`)
    if (typeof e.pulse === 'number') vitals.push(`пульс ${e.pulse}`)
    if (typeof e.systolic === 'number' && typeof e.diastolic === 'number') vitals.push(`АД ${e.systolic}/${e.diastolic}`)
    if (typeof e.mood === 'number') vitals.push(`настроение ${e.mood}/5`)
    if (typeof e.painScore === 'number') vitals.push(`боль ${e.painScore}/10`)
    if (vitals.length) lines.push(`Показатели: ${vitals.join(', ')}`)
    const text = lines.join('\n')
    const s = scoreChunk(queryTokens, text)
    if (s > 0) {
      scored.push({
        score: s + 1,
        source: {
          sourceType: 'diary',
          id: e.id,
          label: `Дневник ${dateIso ? new Date(dateIso).toLocaleDateString('ru-RU') : ''}`.trim(),
          date: dateIso,
          url: null,
          snippet: text
        },
        snippet: text
      })
    }
  }

  // knowledge
  for (const k of kbIndicators as any[]) {
    const text = [
      `Показатель: ${k.name}${k.shortName ? ` (${k.shortName})` : ''}; Ед.: ${k.unit}`,
      k.description ? `Описание: ${k.description}` : '',
      k.increasedMeaning ? `Повышение: ${k.increasedMeaning}` : '',
      k.decreasedMeaning ? `Понижение: ${k.decreasedMeaning}` : '',
      k.maintenanceRecommendations ? `Поддержание: ${k.maintenanceRecommendations}` : '',
      k.improvementRecommendations ? `Улучшение: ${k.improvementRecommendations}` : ''
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 900)
    const s = scoreChunk(queryTokens, text)
    if (s > 0) {
      scored.push({
        score: s + 1,
        source: {
          sourceType: 'knowledge',
          id: k.id,
          label: k.name,
          date: null,
          url: null,
          snippet: text
        },
        snippet: text
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const picked: typeof scored = []
  const byType = (t: RagSource['sourceType']) => scored.filter((x) => x.source.sourceType === t)
  for (const t of ['analysis', 'document', 'diary', 'knowledge'] as const) {
    picked.push(...byType(t).slice(0, 2))
  }
  for (const x of scored) {
    if (picked.length >= 10) break
    if (picked.some((p) => p.source.sourceType === x.source.sourceType && p.source.id === x.source.id && p.snippet === x.snippet)) continue
    picked.push(x)
  }
  // Дедуп по источнику (sourceType + id), чтобы не возвращать несколько чанков одного и того же анализа/документа.
  const topUnique: typeof picked = []
  const seenSrc = new Set<string>()
  for (const x of picked) {
    if (topUnique.length >= 10) break
    const key = `${x.source.sourceType}:${x.source.id}`
    if (seenSrc.has(key)) continue
    seenSrc.add(key)
    topUnique.push(x)
  }
  const top = topUnique

  const sources: RagSource[] = top.map((x) => ({ ...x.source, snippet: x.snippet }))
  const promptBlocks = top.map((x, idx) => {
    const src = x.source
    const dateStr = src.date ? new Date(src.date).toLocaleDateString('ru-RU') : '—'
    const urlStr = src.url ? `; URL: ${src.url}` : ''
    const header = `[SOURCE ${idx + 1}] (${src.sourceType.toUpperCase()}) ${src.label}; Дата: ${dateStr}${urlStr}`
    return `${header}\n${sanitizeRagSnippet(x.snippet)}`
  })

  return { sources, contextText: promptBlocks.join('\n\n') }
}

// Генерация обычного AI ответа (с RAG по прикрепленным документам / по всем данным пользователя)
async function generateAIResponse(
  message: string,
  userId: string,
  history: any[],
  documentIds: string[],
  ragScope: 'none' | 'attached' | 'patient_data' | 'app_knowledge' | 'marketplace'
): Promise<AiResponseWithSources> {
  const patientProfile = await prisma.patientProfile.findUnique({ where: { userId } }).catch(() => null)
  const hasDocs = Array.isArray(documentIds) && documentIds.length > 0
  const rag =
    ragScope === 'patient_data' || ragScope === 'marketplace'
      ? await buildAllUserRagContext(userId, message)
      : ragScope === 'attached' && hasDocs
        ? await buildRagContext(userId, message, documentIds)
        : { sources: [], contextText: '' }

  const systemPrompt = buildAssistantSystemPrompt()
  const profileBlock = patientProfile
    ? `\n\nПРОФИЛЬ ПАЦИЕНТА (контекст, если релевантно):\n${JSON.stringify(patientProfile)}\n`
    : ''
  const historyBlock = Array.isArray(history) && history.length > 0
    ? `\n\nПОСЛЕДНИЕ СООБЩЕНИЯ:\n${history
        .slice(-8)
        .map((m: any) => `${m?.role === 'assistant' ? 'Ассистент' : 'Пользователь'}: ${String(m?.content || '').slice(0, 700)}`)
        .join('\n')}`
    : ''
  const userBlock =
    rag.contextText && rag.contextText.trim().length > 0
      ? `ДАННЫЕ (RAG):\n${rag.contextText}${profileBlock}${historyBlock}\n\nВопрос пользователя: ${message}`
      : `${profileBlock}${historyBlock}\n\nВопрос пользователя: ${message}`

  const llm = await tryAssistantLlm({
    system: systemPrompt,
    user: userBlock,
    temperature: 0.35,
  })

  if (llm) {
    return {
      response: llm.text,
      sources: rag.sources,
      provider: llm.provider,
      model: llm.model,
      latencyMs: llm.latencyMs,
    }
  }

  // Fallback ответы
  const lowerMessage = message.toLowerCase()

  if (isAnalysisDeepDiveRequest(message)) {
    const abnormal = await collectUserAbnormalIndicators(userId)
    if (abnormal.length > 0) {
      const structured = formatAbnormalIndicatorsForChat(abnormal)
      return {
        response: `${structured}\n\n---\nПолный текстовый разбор с пояснениями сейчас недоступен: не отвечает AI-модель (DeepSeek/Ollama). Проверьте DEEPSEEK_API_KEY или запуск Ollama в настройках админки и перезапустите сервер.`,
        sources: rag.sources,
      }
    }
    if (rag.sources.length > 0) {
      return {
        response:
          'По вашим данным есть источники для разбора, но AI-модель сейчас недоступна. Настройте DeepSeek (DEEPSEEK_API_KEY) или Ollama и повторите вопрос — тогда смогу дать полный разбор с пояснениями.',
        sources: rag.sources,
      }
    }
  }

  if (lowerMessage.match(/привет|здравствуй|добрый день/)) {
    return {
      response:
        'Здравствуйте! Я ваш персональный медицинский ассистент.\n\nЯ могу помочь вам:\n\n• Записаться на прием к врачу\n• Показать результаты анализов\n• Дать персональные рекомендации\n• Найти подходящего врача\n\nЧто вас интересует?',
      sources: rag.sources
    }
  }

  if (lowerMessage.match(/помощь|что ты умеешь|возможности/)) {
    return {
      response:
        'Я умею:\n\n• Запись на прием: "Запиши меня на прием к терапевту завтра в 10:00"\n• Результаты анализов: "Покажи мои последние анализы крови"\n• Рекомендации: "Дай мне рекомендации по питанию"\n• Поиск врачей: "Найди кардиолога"\n• Мои записи: "Покажи мои предстоящие приемы"\n\nЕсли вы прикрепите документы в чате — я смогу отвечать по ним (с источниками).',
      sources: rag.sources
    }
  }

  if (lowerMessage.match(/спасибо|благодарю/)) {
    return { response: 'Пожалуйста! Рад был помочь. Если возникнут еще вопросы — обращайтесь!', sources: rag.sources }
  }

  if (lowerMessage.match(/как дела|как ты/)) {
    return { response: 'У меня все отлично! Готов помочь вам с медицинскими вопросами и задачами.', sources: rag.sources }
  }

  if (lowerMessage.match(/время|дата|сегодня|завтра/)) {
    const now = new Date()
    return {
      response: `Сегодня: ${now.toLocaleDateString('ru-RU')}\nВремя: ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n\nНужна помощь с записью на прием?`,
      sources: rag.sources
    }
  }

  // Если есть источники, но LLM недоступен — скажем прямо и покажем, что нашли
  if (rag.sources.length > 0) {
    const abnormal = await collectUserAbnormalIndicators(userId).catch(() => [])
    const abnormalBlock =
      abnormal.length > 0 ? `\n\n${formatAbnormalIndicatorsForChat(abnormal)}\n\n` : '\n\n'
    return {
      response:
        `Я вижу ваши данные, но AI-модель сейчас недоступна.${abnormalBlock}Источники:\n${rag.sources
          .slice(0, 5)
          .map((s, idx) => `- ${s.label}${s.url ? ` (${s.url})` : ''}`)
          .join('\n')}\n\nПроверьте DeepSeek (DEEPSEEK_API_KEY) или Ollama в .env.local и в админке — после этого отвечу полноценным разбором.`,
      sources: rag.sources
    }
  }

  return {
    response:
      'Я готов помочь вам с медицинскими вопросами! Попробуйте спросить:\n\n• "Запиши меня на прием к врачу"\n• "Покажи мои анализы"\n• "Дай рекомендации по здоровью"\n• "Найди терапевта"\n• "Покажи мои записи на приемы"',
    sources: rag.sources
  }
}

// Вспомогательные функции
function getAppointmentTypeLabel(type: string): string {
  switch (type) {
    case 'consultation': return 'Консультация'
    case 'follow_up': return 'Повторный прием'
    case 'routine': return 'Плановый осмотр'
    case 'emergency': return 'Срочный прием'
    default: return type
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled': return 'Запланировано'
    case 'confirmed': return 'Подтверждено'
    case 'completed': return 'Завершено'
    case 'cancelled': return 'Отменено'
    case 'rescheduled': return 'Перенесено'
    default: return status
  }
}
