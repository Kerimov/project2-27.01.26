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

type RiskLevel = 'ok' | 'attention' | 'urgent'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizeText(s: string) {
  return (s || '').toLowerCase().replace(/ё/g, 'е')
}

function extractIndicators(resultsJson: any) {
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

function ruleBasedTriage(params: {
  analysisStatus?: string
  indicators: any[]
  symptoms?: string
}): { level: RiskLevel; reasons: string[]; confidence: number; redFlags: string[]; nextSteps: string[] } {
  const reasons: string[] = []
  const redFlags: string[] = []
  const nextSteps: string[] = []

  const abnormal = (params.indicators || []).filter((x) => x && x.isNormal === false)
  const status = (params.analysisStatus || '').toLowerCase()

  let level: RiskLevel = 'ok'
  if (status === 'critical') {
    level = 'urgent'
    reasons.push('Статус анализа отмечен как "критично".')
  } else if (status === 'abnormal') {
    level = 'attention'
    reasons.push('Статус анализа отмечен как "отклонение".')
  } else if (abnormal.length > 0) {
    level = 'attention'
    reasons.push(`Есть отклонения по показателям: ${abnormal.slice(0, 6).map((x) => x.name).join(', ')}.`)
  } else {
    reasons.push('По имеющимся данным выраженных отклонений не обнаружено.')
  }

  const sx = normalizeText(params.symptoms || '')
  const urgentSx = [
    'боль в груди',
    'давит в груди',
    'одышк',
    'удушье',
    'потеря сознания',
    'обморок',
    'сильная слабость',
    'кровь',
    'судорог',
    'онемение',
    'перекос лица',
    'нарушение речи',
    'сильная головная боль',
    'температура 39',
    'температура 40'
  ]
  if (sx && urgentSx.some((k) => sx.includes(k))) {
    level = 'urgent'
    reasons.push('Описанные симптомы могут требовать срочной помощи.')
    redFlags.push('При боли в груди, выраженной одышке, потере сознания, признаках инсульта — вызывайте скорую.')
  }

  if (level === 'ok') {
    nextSteps.push('Если есть симптомы — обсудите результаты с врачом, даже при нормальных показателях.')
    nextSteps.push('Сдавайте повторные анализы в сопоставимых условиях (натощак/время суток), если назначено.')
  } else if (level === 'attention') {
    nextSteps.push('Запишитесь к врачу для интерпретации отклонений в контексте симптомов и анамнеза.')
    nextSteps.push('Проверьте условия сдачи (натощак, лекарства, нагрузка) — они могут влиять на результат.')
    nextSteps.push('При ухудшении самочувствия — обратитесь за неотложной помощью.')
  } else {
    nextSteps.push('Если есть опасные симптомы — вызывайте скорую (103/112) или обратитесь в неотложку.')
    nextSteps.push('Не откладывайте консультацию врача, если указаны критические отклонения.')
  }

  // confidence: больше, если статус критичный/есть отклонения, меньше если данных мало
  let conf = 35
  if (status === 'critical') conf += 25
  if (abnormal.length > 0) conf += 10
  if ((params.indicators || []).length >= 10) conf += 10
  if (sx) conf += 5
  conf = clamp(conf, 15, 80)

  return { level, reasons, confidence: conf, redFlags, nextSteps }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json()
    const analysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : ''
    const symptoms = typeof body?.symptoms === 'string' ? body.symptoms.trim() : ''

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

    const indicators = extractIndicators(parsed).slice(0, 120)

    const base = ruleBasedTriage({
      analysisStatus: analysis.status,
      indicators,
      symptoms
    })

    // Если Ollama доступен — попросим кратко уточнить причины/красные флаги (без диагноза).
    if (isOllamaConfigured()) {
      const systemPrompt = `Ты — медицинский ассистент по триажу.

ОГРАНИЧЕНИЯ:
- Не ставь диагнозы.
- Не выдумывай факты вне данных.
- Если данных мало — снижай уверенность и задавай уточняющие вопросы.

Отвечай СТРОГО в JSON:
{
  "level": "ok|attention|urgent",
  "confidence": 0,
  "reasons": ["..."],
  "redFlags": ["... когда в скорую ..."],
  "nextSteps": ["... что делать дальше ..."],
  "questions": ["... что уточнить ..."]
}`

      const userPrompt = `Анализ: ${analysis.title} (${analysis.type}), дата ${analysis.date.toISOString().slice(0, 10)}, статус: ${analysis.status}
Симптомы: ${symptoms || '—'}
Показатели (частично): ${JSON.stringify(indicators.slice(0, 40), null, 2)}
Rule-based triage: ${JSON.stringify(base, null, 2)}

Сделай осторожное уточнение триажа.`

      const text = await callOllamaChat({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.2,
        responseFormat: { type: 'json_object' }
      })

      const ai = safeJsonParse(text) as any
      if (ai && typeof ai === 'object') {
        const level = (ai.level === 'urgent' || ai.level === 'attention' || ai.level === 'ok') ? (ai.level as RiskLevel) : base.level
        const confidence = typeof ai.confidence === 'number' ? clamp(Math.round(ai.confidence), 0, 100) : base.confidence
        return NextResponse.json({
          analysisId,
          level,
          confidence,
          reasons: Array.isArray(ai.reasons) ? ai.reasons.slice(0, 8) : base.reasons,
          redFlags: Array.isArray(ai.redFlags) ? ai.redFlags.slice(0, 8) : base.redFlags,
          nextSteps: Array.isArray(ai.nextSteps) ? ai.nextSteps.slice(0, 10) : base.nextSteps,
          questions: Array.isArray(ai.questions) ? ai.questions.slice(0, 8) : []
        })
      }
    }

    return NextResponse.json({
      analysisId,
      level: base.level,
      confidence: base.confidence,
      reasons: base.reasons,
      redFlags: base.redFlags,
      nextSteps: base.nextSteps,
      questions: []
    })
  } catch (error) {
    console.error('[risk-triage] error:', error)
    const msg = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


