import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pearson(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return { r: 0, n }
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx
    const vy = ys[i] - my
    num += vx * vy
    dx += vx * vx
    dy += vy * vy
  }
  const den = Math.sqrt(dx * dy) || 1
  return { r: num / den, n }
}

function avg(values: Array<number | null | undefined>) {
  const xs = values.map(toNumber).filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function splitWeeks(entries: any[], end: Date, days = 7) {
  const endMs = end.getTime()
  const aStart = new Date(endMs - days * 24 * 60 * 60 * 1000)
  const bStart = new Date(endMs - 2 * days * 24 * 60 * 60 * 1000)

  const weekA = entries.filter((e) => {
    const t = new Date(e.entryDate).getTime()
    return t >= aStart.getTime() && t <= endMs
  })
  const weekB = entries.filter((e) => {
    const t = new Date(e.entryDate).getTime()
    return t >= bStart.getTime() && t < aStart.getTime()
  })

  return { weekA, weekB, aStart, bStart }
}

function extractTopSymptoms(entries: any[]) {
  const map = new Map<string, number>()
  for (const e of entries) {
    const raw = `${e.symptoms || ''} ${e.notes || ''}`.toLowerCase()
    const tokens = raw
      .split(/[,.;\n]+|\s{2,}|\s-\s|\s/gi)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && t.length <= 32)
    for (const t of tokens) {
      // убираем шумовые слова
      if (['это', 'как', 'что', 'очень', 'сегодня', 'вчера', 'потом', 'после', 'перед'].includes(t)) continue
      map.set(t, (map.get(t) || 0) + 1)
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token, count]) => ({ token, count }))
}

export async function POST(request: NextRequest) {
  try {
    // auth: bearer or cookie
    const auth = request.headers.get('authorization')
    let token = auth?.startsWith('Bearer ') ? auth.replace('Bearer ', '') : null
    if (!token) {
      const cookieHeader = request.headers.get('cookie')
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
      token = cookies.token || null
    }
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const days = typeof body?.days === 'number' && body.days > 0 && body.days <= 30 ? Math.floor(body.days) : 7
    const end = body?.endDate ? new Date(body.endDate) : new Date()

    const entries = await prisma.healthDiaryEntry.findMany({
      where: { userId: payload.userId },
      orderBy: { entryDate: 'desc' },
      take: 150
    })

    const { weekA, weekB } = splitWeeks(entries, end, days)

    const metrics = ['sleepHours', 'steps', 'pulse', 'systolic', 'diastolic', 'temperature', 'weight'] as const
    const targets = ['painScore', 'mood'] as const

    const correlations: Array<{ metric: string; target: string; r: number; n: number }> = []
    for (const m of metrics) {
      for (const t of targets) {
        const pairs = weekA
          .map((e) => ({ x: toNumber((e as any)[m]), y: toNumber((e as any)[t]) }))
          .filter((p) => p.x !== null && p.y !== null) as Array<{ x: number; y: number }>
        const xs = pairs.map((p) => p.x)
        const ys = pairs.map((p) => p.y)
        const { r, n } = pearson(xs, ys)
        if (n >= 3) correlations.push({ metric: m, target: t, r: Number(r.toFixed(3)), n })
      }
    }

    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))

    const aAvg = {
      mood: avg(weekA.map((e) => e.mood)),
      painScore: avg(weekA.map((e) => e.painScore)),
      sleepHours: avg(weekA.map((e) => e.sleepHours)),
      steps: avg(weekA.map((e) => e.steps)),
      pulse: avg(weekA.map((e) => e.pulse)),
      systolic: avg(weekA.map((e) => e.systolic)),
      diastolic: avg(weekA.map((e) => e.diastolic)),
      temperature: avg(weekA.map((e) => e.temperature)),
      weight: avg(weekA.map((e) => e.weight))
    }
    const bAvg = {
      mood: avg(weekB.map((e) => e.mood)),
      painScore: avg(weekB.map((e) => e.painScore)),
      sleepHours: avg(weekB.map((e) => e.sleepHours)),
      steps: avg(weekB.map((e) => e.steps)),
      pulse: avg(weekB.map((e) => e.pulse)),
      systolic: avg(weekB.map((e) => e.systolic)),
      diastolic: avg(weekB.map((e) => e.diastolic)),
      temperature: avg(weekB.map((e) => e.temperature)),
      weight: avg(weekB.map((e) => e.weight))
    }

    const topSymptoms = extractTopSymptoms(weekA)

    const analyses = await prisma.analysis.findMany({
      where: { userId: payload.userId },
      orderBy: { date: 'desc' },
      take: 5
    })
    const recentAnalysisSummary = analyses.map((a) => {
      let abnormal: string[] = []
      try {
        const r = JSON.parse(a.results || '{}')
        const inds = Array.isArray(r?.indicators) ? r.indicators : []
        abnormal = inds.filter((i: any) => i?.isNormal === false).map((i: any) => String(i?.name || '').trim()).filter(Boolean)
      } catch {}
      return {
        id: a.id,
        date: a.date,
        title: a.title,
        status: a.status,
        abnormalIndicators: abnormal.slice(0, 12)
      }
    })

    const dataQuality: string[] = []
    if (weekA.length < 4) dataQuality.push('Мало записей за неделю — выводы будут неточными (желательно 4+).')
    const missingCount = metrics
      .map((m) => weekA.filter((e) => toNumber((e as any)[m]) === null).length)
      .reduce((a, b) => a + b, 0)
    if (missingCount > metrics.length * Math.max(1, weekA.length) * 0.5) dataQuality.push('Много пропусков по метрикам (сон/пульс/АД/шаги) — корреляции условные.')

    const whatInfluenced: string[] = []
    const top = correlations.slice(0, 4)
    for (const c of top) {
      const dir = c.r > 0 ? 'растёт' : 'снижается'
      whatInfluenced.push(`В этой неделе при росте "${c.metric}" в среднем ${dir} "${c.target}" (r=${c.r}, n=${c.n}).`)
    }
    if (topSymptoms.length > 0) {
      whatInfluenced.push(`Чаще всего встречались слова/симптомы: ${topSymptoms.map((s) => `${s.token} (${s.count})`).join(', ')}.`)
    }

    const baseResult = {
      tldr: weekA.length === 0
        ? 'За выбранный период нет записей дневника.'
        : `Обзор за последние ${days} дней: записей ${weekA.length}.`,
      period: {
        days,
        endDate: end.toISOString()
      },
      weekAverages: aAvg,
      previousWeekAverages: bAvg,
      whatInfluenced,
      hypotheses: [
        {
          hypothesis: 'Недосып может усиливать субъективную боль и снижать настроение.',
          evidence: correlations.find((x) => x.metric === 'sleepHours' && (x.target === 'painScore' || x.target === 'mood')) || null,
          experiment: '7 дней: фиксировать сон (ложиться в одно время) + 20–30 мин прогулки; сравнить среднюю боль/настроение.'
        },
        {
          hypothesis: 'Повышенный пульс/АД может совпадать со стрессом/симптомами или недостатком восстановления.',
          evidence: correlations.find((x) => (x.metric === 'pulse' || x.metric === 'systolic') && (x.target === 'painScore' || x.target === 'mood')) || null,
          experiment: '3–5 дней: измерять пульс/АД утром и вечером + отметить стресс/кофеин; посмотреть, когда показатели выше.'
        }
      ],
      correlations,
      recentAnalyses: recentAnalysisSummary,
      dataQuality,
      disclaimer: 'Это не диагноз и не медицинская рекомендация. При ухудшении самочувствия — обратитесь к врачу.'
    }

    // If no key, return rules-only
    if (!isOllamaConfigured()) {
      return NextResponse.json({ result: baseResult, usedLLM: false })
    }

    const system = [
      'Ты — медицинский ассистент по дневнику здоровья.',
      'Задача: объяснить наблюдаемые связи между сном/стрессом/симптомами и динамикой самочувствия (боль/настроение) и витальными показателями.',
      'Правила: аккуратные формулировки, без диагностики, без категоричных причинно-следственных утверждений, предлагай безопасные эксперименты/наблюдения.',
      'Ответ строго JSON (json_object).'
    ].join('\n')

    const user = `Данные пользователя (агрегаты недели и корреляции):\n${JSON.stringify(baseResult, null, 2)}\n\nСформируй JSON с полями:\n- tldr (string)\n- whatInfluenced (string[] до 6)\n- hypotheses (array ровно 2 объекта: {hypothesis,evidence,experiment})\n- questionsToImprove (string[] до 5)\n- redFlags (string[] до 5)\n- nextSteps (string[] до 6)\nСохрани численные значения r/n если они есть (не выдумывай).`

    const text = await callOllamaJson(system, user)
    const parsed = JSON.parse(text)

    const merged = {
      ...baseResult,
      tldr: typeof parsed?.tldr === 'string' ? parsed.tldr : baseResult.tldr,
      whatInfluenced: Array.isArray(parsed?.whatInfluenced) ? parsed.whatInfluenced.slice(0, 6) : baseResult.whatInfluenced,
      hypotheses: Array.isArray(parsed?.hypotheses) ? parsed.hypotheses.slice(0, 2) : baseResult.hypotheses,
      questionsToImprove: Array.isArray(parsed?.questionsToImprove) ? parsed.questionsToImprove.slice(0, 5) : [],
      redFlags: Array.isArray(parsed?.redFlags) ? parsed.redFlags.slice(0, 5) : [],
      nextSteps: Array.isArray(parsed?.nextSteps) ? parsed.nextSteps.slice(0, 6) : []
    }

    return NextResponse.json({ result: merged, usedLLM: true })
  } catch (e) {
    console.error('[ai-diary-weekly-review] error:', e)
    return NextResponse.json({ error: 'Ошибка формирования обзора' }, { status: 500 })
  }
}


