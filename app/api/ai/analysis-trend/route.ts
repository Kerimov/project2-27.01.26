import { NextRequest, NextResponse } from 'next/server'
import { parse as parseCookies } from 'cookie'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  buildIndicatorSeries,
  pickDefaultIndicatorName,
} from '@/lib/analysis-indicator-series'
import { callOllamaChat, isOllamaConfigured } from '@/lib/ollama'

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

type TrendPoint = {
  date: string
  value: number
  unit?: string
  isNormal?: boolean | null
  title?: string
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function computeHeuristicConfidence(points: TrendPoint[]) {
  // 0..100, очень грубая эвристика (LLM потом уточнит словами)
  if (!Array.isArray(points) || points.length === 0) return 10
  const values = points.map((p) => p.value).filter((x) => Number.isFinite(x))
  if (values.length === 0) return 10

  let score = 35
  if (points.length >= 2) score += 15
  if (points.length >= 3) score += 10
  if (points.length >= 5) score += 10

  const units = new Set(points.map((p) => (p.unit || '').trim()).filter(Boolean))
  if (units.size <= 1) score += 10
  else score -= 10

  const dates = points
    .map((p) => new Date(p.date).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  if (dates.length >= 2) {
    const spanDays = (dates[dates.length - 1] - dates[0]) / (24 * 60 * 60 * 1000)
    if (spanDays >= 14) score += 5
    if (spanDays >= 60) score += 5
  }

  return clamp(Math.round(score), 5, 85)
}

function formatTrendForClient(result: Record<string, unknown>) {
  const tldr = typeof result.tldr === 'string' ? result.tldr : ''
  const parts: string[] = []
  if (tldr) parts.push(tldr)
  const whatChanged = Array.isArray(result.whatChanged) ? (result.whatChanged as string[]) : []
  if (whatChanged.length) {
    parts.push('', 'Что изменилось:', ...whatChanged.map((x) => `• ${x}`))
  }
  const nextSteps = Array.isArray(result.nextSteps) ? (result.nextSteps as string[]) : []
  if (nextSteps.length) {
    parts.push('', 'Что делать:', ...nextSteps.map((x) => `• ${x}`))
  }
  return parts.join('\n').trim()
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json()
    const analysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : ''
    let indicatorName = typeof body?.indicatorName === 'string' ? body.indicatorName.trim() : ''
    const seriesRaw = Array.isArray(body?.series) ? body.series : []

    let series: TrendPoint[] = seriesRaw
      .map((p: any) => ({
        date: String(p?.date ?? ''),
        value: Number(p?.value),
        unit: typeof p?.unit === 'string' ? p.unit : undefined,
        isNormal: typeof p?.isNormal === 'boolean' ? p.isNormal : null,
        title: typeof p?.title === 'string' ? p.title : undefined
      }))
      .filter((p) => p.date && Number.isFinite(p.value))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (analysisId && (!indicatorName || series.length === 0)) {
      const analysis = await prisma.analysis.findFirst({
        where: { id: analysisId, userId: payload.userId },
      })
      if (!analysis) {
        return NextResponse.json({ error: 'Анализ не найден' }, { status: 404 })
      }

      if (!indicatorName) {
        indicatorName = pickDefaultIndicatorName(analysis.results) || ''
      }

      if (!indicatorName) {
        return NextResponse.json(
          { error: 'В анализе нет числовых показателей для интерпретации тренда' },
          { status: 400 }
        )
      }

      if (series.length === 0) {
        const all = await prisma.analysis.findMany({
          where: { userId: payload.userId },
          orderBy: { date: 'asc' },
          select: { date: true, title: true, results: true },
        })
        series = buildIndicatorSeries(all, indicatorName)
      }
    }

    if (!indicatorName) {
      return NextResponse.json(
        { error: 'Укажите показатель (indicatorName) или анализ (analysisId)' },
        { status: 400 }
      )
    }

    if (series.length === 0) {
      return NextResponse.json(
        {
          error: `Нет данных по показателю «${indicatorName}». Добавьте ещё анализы с этим показателем.`,
        },
        { status: 400 }
      )
    }

    const last = series[series.length - 1]
    const prev = series.length >= 2 ? series[series.length - 2] : null
    const delta = prev ? last.value - prev.value : null
    const deltaPct = prev && prev.value !== 0 ? (delta! / prev.value) * 100 : null
    const min = Math.min(...series.map((p) => p.value))
    const max = Math.max(...series.map((p) => p.value))
    const heuristicConfidence = computeHeuristicConfidence(series)

    // Если ключа нет — отдадим “30 секунд” локально, без LLM.
    if (!isOllamaConfigured()) {
      const tldr =
        series.length < 2
          ? `Есть только одно значение по "${indicatorName}" (${last.value}${last.unit ? ` ${last.unit}` : ''}). Для динамики нужно минимум 2 замера.`
          : `Последнее значение по "${indicatorName}": ${last.value}${last.unit ? ` ${last.unit}` : ''}. Изменение относительно прошлого: ${delta!.toFixed(2)} (${deltaPct !== null ? `${deltaPct.toFixed(1)}%` : '—'}).`

      const result = {
        tldr,
        whatChanged: [] as string[],
        possibleCauses: [] as unknown[],
        confidence: heuristicConfidence,
        redFlags: [] as string[],
        nextSteps: [
          'Если есть симптомы или сильные отклонения — обсудите с врачом.',
          'Для уверенной динамики полезно иметь 2–3 измерения в сопоставимых условиях.',
        ],
        questionsToRefine: [
          'Возраст/пол?',
          'Были ли симптомы/лекарства/инфекции перед сдачей?',
          'Условия сдачи (натощак/время суток)?',
        ],
      }
      const interpretation = formatTrendForClient(result)
      return NextResponse.json({
        indicatorName,
        result,
        interpretation,
        summary: interpretation,
        text: interpretation,
        meta: { last, prev, delta, deltaPct, min, max },
      })
    }

    const systemPrompt = `Ты — медицинский ассистент, который объясняет динамику лабораторных показателей.

ОГРАНИЧЕНИЯ:
- Не ставь диагнозы.
- Не выдумывай факты вне предоставленных данных.
- Пиши на русском, коротко и по делу.

НУЖЕН СТРОГО JSON (без текста вокруг) формата:
{
  "tldr": "1–2 предложения: что главное в динамике (\"за 30 секунд\")",
  "whatChanged": ["2–5 пунктов: что изменилось по времени (числа/направление/контекст)"],
  "possibleCauses": [
    { "cause": "возможная причина", "why": "почему это подходит к динамике", "likelihood": "low|medium|high" }
  ],
  "confidence": 0,
  "redFlags": ["когда срочно к врачу/тревожные признаки (если применимо)"],
  "nextSteps": ["3–7 практических шагов: что сделать дальше"],
  "questionsToRefine": ["что уточнить/какие данные добавить для повышения точности"]
}

ПРАВИЛА confidence:
- 0..100
- учитывай: сколько точек, стабильность единиц, временной диапазон
- НЕ ставь 90+ если точек мало или нет референсов`

    const userPrompt = `Показатель: ${indicatorName}
Данные (в хронологическом порядке):
${JSON.stringify(series, null, 2)}

Вычисленные метрики:
${JSON.stringify({ last, prev, delta, deltaPct, min, max, heuristicConfidence }, null, 2)}

Сделай интерпретацию динамики без диагноза. Укажи confidence (0..100).`

    const text = await callOllamaChat({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.2,
      responseFormat: { type: 'json_object' }
    })

    const parsed = safeJsonParse(text)
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json(
        { error: 'AI returned invalid JSON', raw: text },
        { status: 502 }
      )
    }

    // минимальная нормализация
    const result = {
      tldr: typeof (parsed as any).tldr === 'string' ? (parsed as any).tldr : String(text),
      whatChanged: Array.isArray((parsed as any).whatChanged) ? (parsed as any).whatChanged.slice(0, 7) : [],
      possibleCauses: Array.isArray((parsed as any).possibleCauses) ? (parsed as any).possibleCauses.slice(0, 7) : [],
      confidence:
        typeof (parsed as any).confidence === 'number'
          ? clamp(Math.round((parsed as any).confidence), 0, 100)
          : heuristicConfidence,
      redFlags: Array.isArray((parsed as any).redFlags) ? (parsed as any).redFlags.slice(0, 7) : [],
      nextSteps: Array.isArray((parsed as any).nextSteps) ? (parsed as any).nextSteps.slice(0, 10) : [],
      questionsToRefine: Array.isArray((parsed as any).questionsToRefine) ? (parsed as any).questionsToRefine.slice(0, 10) : []
    }

    const interpretation = formatTrendForClient(result)
    return NextResponse.json({
      indicatorName,
      result,
      interpretation,
      summary: interpretation,
      text: interpretation,
      meta: { last, prev, delta, deltaPct, min, max, heuristicConfidence },
    })
  } catch (error) {
    console.error('[analysis-trend] error:', error)
    const msg = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


