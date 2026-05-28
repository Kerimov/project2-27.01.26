import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { classifyAssistantIntent, stripLeadingSmalltalk, type AssistantIntent } from '@/lib/ai/assistant-router'
import {
  normalizeRouterHistory,
  resolveAssistantIntent,
} from '@/lib/ai/assistant-intent-resolver'
import type { CareCapability } from '@/lib/caretaker-access'
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
import { resolveAssistantPatientContext } from '@/lib/ai/assistant-patient-context'
import {
  runAssistantProjectPipeline,
  type LegacyProjectActionRunner,
} from '@/lib/ai/assistant-tool-executor'
import { runAssistantAgent } from '@/lib/ai/assistant-agent'
import { shouldUseAssistantAgent } from '@/lib/ai-runtime-settings'
import {
  handleProjectActionIntent,
  isCarePlanIntent,
  isPendingBooking,
  type AssistantAction,
  type PendingBooking,
} from '@/lib/ai/assistant-project-actions'
import { tryLegacyAssistantRouter } from '@/lib/ai/assistant-legacy-router'
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
    
    const { message, history, documentIds, ragScope, action, pendingBooking, patientId: bodyPatientId } =
      await request.json()
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

    const hasPendingBookingState = isPendingBooking(pendingBooking)
    const routerHistory = normalizeRouterHistory(history)

    const intentDecision = await resolveAssistantIntent({
      message,
      history: routerHistory,
      hasUiAction: !!action,
      hasPendingBooking: hasPendingBookingState,
    })

    const patientCtx = await resolveAssistantPatientContext({
      payload,
      message,
      explicitPatientId: typeof bodyPatientId === 'string' ? bodyPatientId : null,
      capability: capabilityForIntent(intentDecision.intent, message),
    })
    if ('error' in patientCtx) {
      return NextResponse.json({ error: patientCtx.error }, { status: patientCtx.status })
    }
    const effectivePatientId = patientCtx.patientId

    logAssistantEvent('intent_classified', {
      requestId,
      userId,
      intent: intentDecision.intent,
      confidence: intentDecision.confidence,
      reason: intentDecision.reason,
      routerSource: intentDecision.routerSource,
      suggestedTool: intentDecision.suggestedTool,
    })

    const normalizedDocumentIds: string[] =
      Array.isArray(documentIds) ? documentIds.filter((x) => typeof x === 'string' && x.trim().length > 0) : []

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

    const bypassShortcut = shouldBypassProjectActionShortcut(intentDecision.intent, message)

    const runLegacy: LegacyProjectActionRunner = (params) =>
      handleProjectActionIntent({
        message: params.message,
        userId: params.userId,
        action: params.action as AssistantAction | undefined,
        pendingBooking: params.pendingBooking as PendingBooking | undefined,
        intent: params.intent,
        patientPrefix: params.patientPrefix,
      })

    let pipelineResult = await runAssistantProjectPipeline({
      message,
      intentDecision,
      ctx: patientCtx,
      bypassShortcut,
      action,
      pendingBooking,
      hasUiAction: !!action,
      runLegacyProjectAction: runLegacy,
    })

    // «Привет! покажи записи» — если intent всё же не операционный, повторяем без приветствия
    const strippedCore = stripLeadingSmalltalk(message)
    if (!pipelineResult && strippedCore && strippedCore.length < message.trim().length) {
      const retryIntent = await resolveAssistantIntent({
        message: strippedCore,
        history: routerHistory,
        hasUiAction: !!action,
        hasPendingBooking: hasPendingBookingState,
      })
      if (
        retryIntent.intent !== intentDecision.intent &&
        retryIntent.intent !== 'unknown' &&
        retryIntent.intent !== 'smalltalk' &&
        !shouldBypassProjectActionShortcut(retryIntent.intent, message)
      ) {
        logAssistantEvent('intent_retry', {
          requestId,
          userId,
          intent: retryIntent.intent,
          routerSource: retryIntent.routerSource,
        })
        pipelineResult = await runAssistantProjectPipeline({
          message,
          intentDecision: retryIntent,
          ctx: patientCtx,
          bypassShortcut: shouldBypassProjectActionShortcut(retryIntent.intent, message),
          action,
          pendingBooking,
          hasUiAction: !!action,
          runLegacyProjectAction: runLegacy,
        })
      }
    }

    let projectAction = pipelineResult

    if (
      !projectAction &&
      effectiveRagScope === 'none' &&
      !action &&
      !hasPendingBookingState &&
      (await shouldUseAssistantAgent())
    ) {
      const agentResult = await runAssistantAgent({
        message,
        history,
        intentDecision,
        ctx: patientCtx,
        hasUiAction: !!action,
        action,
        pendingBooking,
        runLegacyProjectAction: runLegacy,
      })
      if (agentResult?.handled) {
        logAssistantEvent('agent_result', {
          requestId,
          userId,
          iterations: agentResult.iterations,
          functionName: agentResult.functionName || null,
        })
        if (patientCtx.prefix && !agentResult.text.startsWith(patientCtx.prefix.trim())) {
          agentResult.text = `${patientCtx.prefix}${agentResult.text}`
        }
        return NextResponse.json({
          ...toLegacyAssistantResponse({ text: agentResult.text, requestId }, {
            functionResult: agentResult.functionResult,
            functionName: agentResult.functionName,
            timestamp: new Date().toISOString(),
          }),
          provider: agentResult.provider,
          model: agentResult.model,
        })
      }
    }

    if (projectAction) {
      if (patientCtx.prefix && !projectAction.message.startsWith(patientCtx.prefix.trim())) {
        projectAction.message = `${patientCtx.prefix}${projectAction.message}`
      }
      const toolDefinition = getAssistantToolDefinition(projectAction.functionName)
      logAssistantEvent('tool_result', {
        requestId,
        userId,
        functionName: projectAction.functionName,
        executionPath: pipelineResult.executionPath,
        suggestedTool: intentDecision.suggestedTool,
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

    // RAG режим: либо по прикрепленным документам, либо "по всем данным пользователя".
    // В RAG режиме не запускаем авто-функции (иначе вопросы уйдут в get_analysis_results и потеряем цитирование).
    if (effectiveRagScope !== 'none') {
      logAssistantEvent('rag_mode', { requestId, userId, effectiveRagScope })

      // Если запрос похож на "сделай план действий" — генерируем план и создаём напоминания.
      if (effectiveRagScope === 'attached' && normalizedDocumentIds.length > 0 && isCarePlanIntent(message)) {
        const planResult = await createCarePlanFromDocuments(effectivePatientId, message, normalizedDocumentIds)
        return NextResponse.json({
          response: planResult.message,
          functionResult: planResult.data,
          functionName: 'create_care_plan',
          sources: planResult.sources,
          requestId,
          timestamp: new Date().toISOString()
        })
      }

      const aiResponse = await generateAIResponse(
        message,
        effectivePatientId,
        history,
        normalizedDocumentIds,
        effectiveRagScope,
        patientCtx
      )
      return NextResponse.json({
        response: aiResponse.response,
        sources: aiResponse.sources,
        requestId,
        provider: (aiResponse as any).provider,
        timestamp: new Date().toISOString()
      })
    }

    logAssistantEvent('legacy_router_check', { requestId, userId })
    const legacyResult = await tryLegacyAssistantRouter(message, effectivePatientId)
    logAssistantEvent('legacy_router_result', {
      requestId,
      userId,
      functionName: legacyResult?.functionName || null,
    })

    if (legacyResult) {
      return NextResponse.json({
        response: legacyResult.message,
        functionResult: legacyResult.data,
        functionName: legacyResult.functionName,
        requestId,
        timestamp: new Date().toISOString(),
      })
    }

    // Обычный AI ответ без функций
    logAssistantEvent('llm_response', { requestId, userId, effectiveRagScope: 'none' })
    const aiResponse = await generateAIResponse(message, effectivePatientId, history, [], 'none', patientCtx)

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

function capabilityForIntent(intent: AssistantIntent, message: string): CareCapability {
  const t = (message || '').toLowerCase()
  if (intent === 'reminders' && /(?:создай|удали|напомни|поставь|новое)\s/i.test(t)) return 'reminders_write'
  if (intent === 'medications' && /(?:добав|удали|удалить|внеси)\s/i.test(t)) return 'medications_write'
  if (intent === 'diary' && /(?:добав|запиш|внеси)\s/i.test(t)) return 'diary_write'
  if (intent === 'reminders') return 'reminders_read'
  if (intent === 'medications') return 'medications_read'
  return 'diary_read'
}

function buildAssistantSystemPrompt() {
  return `Ты — ИИ-ассистент персонального медицинского кабинета PMA (пациент или куратор). Ты НЕ врач: не ставишь диагнозы и не назначаешь лекарства. Помогаешь управлять здоровьем в образовательных целях и направляешь к специалистам при необходимости.

Отвечай на русском. Данные кабинета — в блоках SOURCE и «СВОДКА (server)»; база знаний — в RAG. Не выдумывай цифры, записи и факты.

Доступ к данным (читай из SOURCE/RAG):
- Профиль (аллергии, хроники, цели, возраст, пол)
- Документы (PDF/фото, OCR, ручные правки)
- Анализы (показатели, нормы, даты, комментарии)
- Дневник (настроение, боль, сон, давление, пульс, симптомы, теги)
- Лекарства (препараты, дозы, расписание)
- План ухода (активные/отложенные/выполненные, сроки, повторения, согласование с врачом)
- Напоминания (привязка к анализам, документам, лекарствам)
- Записи к врачу (предстоящие, прошедшие)
- Маркетплейс клиник (каталог, геолокация — если есть в SOURCE)
- База знаний (референсы, описания показателей, методологии)
- Режим куратора (действия «для пациента X», если указано в контексте)

ТВОИ ВОЗМОЖНОСТИ (что делаешь по запросу):

1. Анализы — список/группировка, карточка, сравнение во времени (таблица или текст), тренды («возможно»), triage (норма / неделя / срочно к врачу), разбор отклонений, предложение напоминания пересдать. Создание анализа вручную — предложи загрузить документ или ввести в разделе «Анализы», если в чате нет автоматического создания.

2. Дневник — добавление записи (настроение, боль 1–10, сон, АД/пульс, симптомы, теги), просмотр за период, еженедельный обзор, связь с анализами.

3. Лекарства — показать список, общие рекомендации по приёму и взаимодействиям (без назначения доз рецептурных препаратов). Добавление/изменение — через «Дневник → Лекарства», если чат не выполнил действие автоматически.

4. План ухода — список задач, добавление с повтором, выполнение/отложение, чек-ин «почему не сделано», задачи на согласовании с врачом.

5. Напоминания — показать активные; создание/редактирование — предложи раздел «Напоминания» или сформулируй, что пользователь хочет (дата, канал push/email/SMS по настройкам). В режиме куратора — помечай «для пациента …».

6. Записи к врачу — слоты 9:00–21:00 шаг 15 мин, запись с подтверждением, список предстоящих/прошедших, pre-visit анкета (задай вопросы и резюмируй ответы; сохранение — в разделе записи, если нет API).

7. Маркетплейс — поиск клиники/лаборатории по городу (профиль или уточни город), карточка организации, запись при наличии интеграции.

8. База знаний — объяснение показателей (СРБ, ТТГ, ферритин…), референсы (Минздрав РФ, US, EU — указывай источник), методология (натощак, время суток).

9. Документы — загрузка через интерфейс чата/раздела; после OCR — показ и правки; привязка к анализу/напоминанию.

10. Куратор — переключение контекста на пациента, список связанных, действия от его имени, запрос подтверждения при approval.

11. Аналитика — KPI из СВОДКИ, тренды (сон, давление) текстом, ASCII-графиком или markdown-таблицей.

12. Общее — свободные вопросы по RAG, вложения в чате, medical_report в markdown за период/анализ.

Автоматизация в чате (сервер может выполнить без «перейдите в раздел»):
списки записей, напоминаний, документов, анализов; дневник (добавить/недельный обзор); лекарства и план ухода (показать/добавить задачу/выполнить); запись к врачу (врачи, слоты, подтверждение). Если действие не выполнено сервером — дай пошаговую инструкцию в приложении, не отказывайся от сути запроса.

БЕЗОПАСНОСТЬ — при опасных симптомах (боль в груди, одышка в покое, внезапная слабость руки/ноги, нарушение речи, потеря сознания, сильное кровотечение, судороги, анафилаксия):
- Прерви обычный сценарий.
- Выдели жирным: **ТРЕБУЕТСЯ ЭКСТРЕННАЯ ПОМОЩЬ. НЕМЕДЛЕННО ВЫЗОВИТЕ СКОРУЮ ПО ТЕЛЕФОНУ 103 (112).**
- Краткая помощь до приезда врачей (покой, воротник, не есть/пить при подозрении на инсульт и т.п. — без самолечения).

Запрещено: диагнозы («у вас грипп» → «симптомы могут быть похожи… обратитесь к врачу»); дозы рецептурных препаратов по названию; отмена/смена терапии, назначенной врачом; психиатрические кризисы (линия доверия); прерывание беременности.
На просьбу диагноза/рецепта: «Я не врач и не могу ставить диагноз. Состояние должен оценить специалист очно».
Всегда указывай источник («по базе знаний…», «согласно рекомендациям…»), если опираешься на справочник.

Структура ответа:
- Конкретное действие: (1) подтверди, (2) результат/данные, (3) «нужно ли ещё?».
- Совет/разбор данных: (1) срочность/triage, (2) что видно по данным, (3) возможные причины («возможно»), (4) рекомендация (образ жизни, когда к врачу), (5) следующий шаг (план ухода, запись, график, напоминание).
- Жалобы без экстренности: подзаголовки Срочность / Разбор / Действия до визита / Чего не делать / Уточняющий вопрос.

Уточняющие вопросы при нехватке данных: симптом, когда началось, интенсивность 1–10, что помогает/ухудшает, температура, давление, хронические болезни.

Контекст:
- Мобильный пользователь — короче, уместны ⚠️ 📊 💊 📅.
- Аллергии в профиле — не предлагай группы аллергенов.
- Куратор — помечай действия «для пациента …».

Начало диалога (один раз, если пользователь ещё не задал задачу):
Кратко поприветствуй. Если в «СВОДКА (server)» есть latestSignificantDeviation или abnormalIndicators в SOURCE — назови последнее значимое отклонение с датой. Иначе — без выдуманных отклонений.
Предложи меню: «Какая задача сегодня: анализы, дневник, лекарства, план ухода, напоминания, запись к врачу?»

Работа с SOURCE:
- «Только отклонения» — только вне нормы.
- «Разбор анализа» — структурно по SOURCE.
- Пустой SOURCE — скажи честно, предложи загрузку.
- Счётчики — только из «СВОДКА (server)».
- На «мои записи/анализы/напоминания» — данные из SOURCE, не отсылка «перейдите в раздел».
- Не здоровайся в каждом ответе.`
}

function stripAssistantGreeting(text: string): string {
  const t = String(text || '')
  const trimmed = t.trimStart()
  // Strip only if greeting is at the very start and there is more content after it
  const m = trimmed.match(
    /^(?:(?:привет|здравствуйте|здравствуй|добрый\s+(?:день|вечер|утро))[\s!.,-]*)([\s\S]+)$/i
  )
  if (!m) return t
  const rest = (m[1] || '').trimStart()
  if (rest.length < 8) return t
  return rest
}

async function buildUserCabinetSnapshot(userId: string): Promise<string> {
  const [analysesCount, documentsCount, upcomingAppointments, latestAnalysis, abnormalRows] = await Promise.all([
    prisma.analysis.count({ where: { userId } }),
    prisma.document.count({ where: { userId } }),
    prisma.appointment.count({
      where: {
        patientId: userId,
        scheduledAt: { gte: new Date() },
        status: { not: 'cancelled' },
      } as any,
    }),
    prisma.analysis
      .findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { id: true, title: true, date: true, results: true },
      })
      .catch(() => null),
    collectUserAbnormalIndicators(userId, 3).catch(() => []),
  ])

  let latestAbnormal = 0
  if (latestAnalysis?.results) {
    try {
      const parsed = JSON.parse(latestAnalysis.results as any)
      const inds = Array.isArray(parsed?.indicators) ? parsed.indicators : []
      latestAbnormal = inds.filter((i: any) => i?.isNormal === false || i?.normal === false).length
    } catch {
      latestAbnormal = 0
    }
  }

  const latestDate =
    latestAnalysis?.date instanceof Date
      ? latestAnalysis.date.toISOString().slice(0, 10)
      : latestAnalysis?.date
        ? new Date(String(latestAnalysis.date)).toISOString().slice(0, 10)
        : null

  const topAbnormal = abnormalRows[0]
  const latestSignificantDeviation = topAbnormal
    ? {
        indicatorName: topAbnormal.indicatorName,
        value: topAbnormal.value,
        unit: topAbnormal.unit ?? null,
        analysisTitle: topAbnormal.analysisTitle,
        analysisDate: new Date(topAbnormal.analysisDate).toISOString().slice(0, 10),
      }
    : null

  const payload = {
    analysesCount,
    documentsCount,
    upcomingAppointments,
    latestAnalysis: latestAnalysis
      ? {
          id: latestAnalysis.id,
          title: latestAnalysis.title ?? 'Анализ',
          date: latestDate,
          abnormalIndicators: latestAbnormal,
        }
      : null,
    latestSignificantDeviation,
    recentAbnormalCount: abnormalRows.length,
    note:
      'Эта сводка рассчитана на сервере. Для подсчётов и приветствия используй эти поля; не выдумывай отклонения.',
  }

  return `СВОДКА (server):\n${JSON.stringify(payload, null, 2)}`
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
      indicators: true,
      parsed: true,
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
    // Явно прикреплённые документы — всегда включаем содержимое (даже без ключевых слов в вопросе)
    const hasDocChunks = scored.some((x) => x.docId === d.id)
    if (!hasDocChunks) {
      const fallback = (indicatorText || d.findings || d.rawText || '').toString().slice(0, 2400)
      if (fallback) {
        scored.push({ score: documentIds.length > 0 ? 50 : 1, docId: d.id, docMeta: d, snippet: fallback })
      } else if (!d.parsed) {
        scored.push({
          score: 10,
          docId: d.id,
          docMeta: d,
          snippet: `[Документ «${d.fileName}» ещё обрабатывается (OCR). Подождите и повторите вопрос.]`,
        })
      }
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

  const [docs, analyses, diary, kbIndicators, abnormalRows, snapshot] = await Promise.all([
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
    buildUserCabinetSnapshot(userId).catch(() => null),
  ])

  const scored: Array<{ score: number; source: RagSource; snippet: string }> = []

  if (snapshot) {
    scored.push({
      score: 95,
      source: {
        sourceType: 'analysis',
        id: 'cabinet-snapshot',
        label: 'Сводка кабинета: анализы/документы/записи',
        date: null,
        url: null,
        snippet: snapshot,
      },
      snippet: snapshot,
    })
  }

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
  ragScope: 'none' | 'attached' | 'patient_data' | 'app_knowledge' | 'marketplace',
  patientCtx?: { prefix: string; isCaretakerMode: boolean; patientName: string | null }
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
  const caretakerNote =
    patientCtx?.isCaretakerMode && patientCtx.patientName
      ? `\n\nРЕЖИМ КУРАТОРА: действия и данные для пациента «${patientCtx.patientName}» (id: ${userId}).\n`
      : ''
  const userBlock =
    rag.contextText && rag.contextText.trim().length > 0
      ? `ДАННЫЕ (RAG):\n${rag.contextText}${profileBlock}${caretakerNote}${historyBlock}\n\nВопрос пользователя: ${message}`
      : `${profileBlock}${caretakerNote}${historyBlock}\n\nВопрос пользователя: ${message}`

  const llm = await tryAssistantLlm({
    system: systemPrompt,
    user: userBlock,
    temperature: 0.35,
  })

  if (llm) {
    return {
      response: stripAssistantGreeting(llm.text),
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
    const snapshotRaw = await buildUserCabinetSnapshot(userId).catch(() => '')
    let deviationLine = ''
    try {
      const m = snapshotRaw.match(/"latestSignificantDeviation":\s*(\{[\s\S]*?\}|null)/)
      if (m && m[1] && m[1] !== 'null') {
        const d = JSON.parse(m[1])
        if (d?.indicatorName) {
          const unit = d.unit ? ` ${d.unit}` : ''
          deviationLine = `\n\nПо последнему анализу (${d.analysisDate || '—'}) отмечено: ${d.indicatorName} ${d.value}${unit} (вне нормы).`
        }
      }
    } catch {
      /* ignore parse errors */
    }
    return {
      response:
        `Здравствуйте! Я ИИ-ассистент персонального медицинского кабинета (не врач).${deviationLine}\n\nКакая задача сегодня: посмотреть анализы, добавить запись в дневник, проверить лекарства, план ухода, напоминания или записаться к врачу?`,
      sources: rag.sources
    }
  }

  if (lowerMessage.match(/помощь|что ты умеешь|возможности/)) {
    return {
      response:
        'Я помогаю с кабинетом (не ставлю диагнозы и не назначаю лекарства):\n\n' +
        '• **Анализы:** список, отклонения, карточка, сравнение, triage, создание, напоминание пересдать\n' +
        '• **Дневник:** запись, фильтр по периоду/тегам, AI-обзор недели, связь с анализами\n' +
        '• **Лекарства:** список, добавить/удалить, взаимодействия (справочно), план приёма\n' +
        '• **План ухода:** задачи, выполнить/отложить, согласование с врачом\n' +
        '• **Напоминания:** создать, удалить, список (push/email/SMS по настройкам)\n' +
        '• **Записи:** слоты 9:00–21:00, запись, отмена, анкета перед визитом\n' +
        '• **Маркетплейс:** поиск клиник/лабораторий\n' +
        '• **База знаний:** что означает показатель, референсы\n' +
        '• **KPI / отчёт:** дашборд, medical_report в markdown\n' +
        '• **Куратор:** список пациентов, действия для подопечного\n\n' +
        'Примеры: «сравни глюкозу», «создай напоминание через 3 месяца», «отмени запись», «медицинский отчёт за 3 месяца».',
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
