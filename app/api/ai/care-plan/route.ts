import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { parse as parseCookies } from 'cookie'

export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1])
    } catch {}
  }
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function extractIndicatorsFromAnalysisResults(resultsJson: any) {
  // нормализуем в массив объектов вида {name,value,unit,referenceMin,referenceMax,isNormal}
  if (!resultsJson) return []
  if (Array.isArray(resultsJson?.indicators)) return resultsJson.indicators
  if (Array.isArray(resultsJson)) return resultsJson
  if (typeof resultsJson === 'object') {
    return Object.entries(resultsJson).map(([name, v]: any) => ({
      name,
      value: v?.value ?? '',
      unit: v?.unit,
      referenceMin: v?.referenceMin ?? null,
      referenceMax: v?.referenceMax ?? null,
      isNormal: v?.isNormal ?? v?.normal ?? null
    }))
  }
  return []
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json()
    const analysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : ''
    const goal = typeof body?.goal === 'string' ? body.goal.trim() : ''

    if (!analysisId) return NextResponse.json({ error: 'analysisId is required' }, { status: 400 })

    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, userId: payload.userId }
    })
    if (!analysis) return NextResponse.json({ error: 'Анализ не найден' }, { status: 404 })

    let parsed: any = null
    try {
      parsed = typeof analysis.results === 'string' ? JSON.parse(analysis.results) : analysis.results
    } catch {
      parsed = null
    }

    const indicators = extractIndicatorsFromAnalysisResults(parsed)
      .filter((x: any) => x && typeof x === 'object' && x.name)
      .slice(0, 120)

    if (!isOllamaConfigured()) {
      return NextResponse.json(
        {
          error:
            'Ollama недоступна. Запустите `ollama serve`, установите модель `ollama pull llama3.2` и перезапустите сервер.',
        },
        { status: 400 }
      )
    }

    const systemPrompt = `Ты — медицинский ассистент. Твоя задача — сформировать практичный план действий по результатам анализов.

ОГРАНИЧЕНИЯ:
- Не ставь диагнозы.
- Если данных недостаточно — укажи, какие данные нужны.
- План должен быть на 2–4 недели (3–7 задач).

ОТВЕТ СТРОГО В JSON (без текста вокруг):
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

Правила:
- dueInDays: 0..90
- channels: минимум 1
- Включай контрольные сроки (повторный анализ/консультация), если есть отклонения.`

    const userPrompt = `Данные анализа:
- Название: ${analysis.title}
- Тип: ${analysis.type}
- Дата: ${analysis.date.toISOString().slice(0, 10)}
- Лаборатория: ${analysis.laboratory || '—'}
- Статус: ${analysis.status}
- Показатели (объекты могут содержать referenceMin/referenceMax/isNormal):
${JSON.stringify(indicators, null, 2)}

Пожелание пользователя (если есть): ${goal || '—'}

Сформируй план.`

    const text = await callOllamaChat({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.2,
      responseFormat: { type: 'json_object' }
    })

    const plan = safeJsonParse(text)
    const tasks = Array.isArray(plan?.tasks) ? plan.tasks : []
    if (tasks.length === 0) {
      return NextResponse.json({ error: 'AI не вернул tasks', raw: text }, { status: 502 })
    }

    const now = Date.now()
    const createdReminders: any[] = []
    const createdTasks: any[] = []
    for (const t of tasks.slice(0, 7)) {
      const title = String(t?.title || '').trim()
      if (!title) continue
      const description = String(t?.description || '').trim() || null
      const dueInDays = clamp(Number(t?.dueInDays ?? 0) || 0, 0, 90)
      const dueAt = new Date(now + dueInDays * 24 * 60 * 60 * 1000)
      const recurrence = normalizeRecurrence(String(t?.recurrence || 'NONE'))
      const channels = normalizeChannels(t?.channels)

      // 1) создаём задачу плана действий (timeline)
      const task = await prisma.carePlanTask.create({
        data: {
          userId: payload.userId,
          analysisId: analysis.id,
          title,
          description,
          dueAt,
          recurrence,
          channels
        }
      })
      createdTasks.push(task)

      // 2) MVP: продолжаем создавать напоминания, чтобы не сломать существующий UX
      const reminder = await prisma.reminder.create({
        data: {
          userId: payload.userId,
          analysisId: analysis.id,
          title,
          description,
          dueAt,
          recurrence,
          channels
        }
      })
      createdReminders.push(reminder)

      // 3) связываем задачу с reminder (не обязательное поле, но полезно)
      await prisma.carePlanTask.update({
        where: { id: task.id },
        data: { reminderId: reminder.id }
      }).catch(() => {})
    }

    return NextResponse.json({
      message: `Создано задач: ${createdTasks.length}, напоминаний: ${createdReminders.length}`,
      tasks: createdTasks,
      reminders: createdReminders,
      plan: { tasks: tasks.slice(0, 7) }
    })
  } catch (error) {
    console.error('[care-plan] error:', error)
    const msg = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


