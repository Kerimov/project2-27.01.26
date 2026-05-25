import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { parse as parseCookies } from 'cookie'

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

function normalizeName(s: string) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function parseIndicatorsFromAnalysisResults(resultsString: string): Array<{ name: string; value: any; unit?: string; isNormal?: any }> {
  try {
    const parsed = JSON.parse(resultsString)
    if (parsed?.indicators && Array.isArray(parsed.indicators)) {
      return parsed.indicators
        .filter((x: any) => x && typeof x.name === 'string')
        .map((x: any) => ({ name: String(x.name), value: x.value, unit: x.unit, isNormal: x.isNormal }))
    }
    // fallback: sometimes results may be a map
    if (parsed && typeof parsed === 'object') {
      const out: Array<{ name: string; value: any; unit?: string; isNormal?: any }> = []
      for (const [k, v] of Object.entries(parsed)) {
        if (!k) continue
        if (v && typeof v === 'object' && 'value' in (v as any)) {
          out.push({ name: k, value: (v as any).value, unit: (v as any).unit, isNormal: (v as any).normal ?? (v as any).isNormal })
        }
      }
      return out
    }
  } catch {
    // ignore
  }
  return []
}

function getTokenFromRequest(request: NextRequest) {
  const auth = request.headers.get('authorization')
  let token = auth?.startsWith('Bearer ') ? auth.replace('Bearer ', '') : null
  if (!token) {
    const cookieHeader = request.headers.get('cookie')
    const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
    token = cookies.token || null
  }
  return token
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const analyses = await prisma.analysis.findMany({
      where: { userId: payload.userId },
      orderBy: { date: 'desc' },
      take: 50
    })

    const names = new Map<string, { name: string; count: number }>()
    for (const a of analyses) {
      const indicators = parseIndicatorsFromAnalysisResults(a.results)
      for (const ind of indicators) {
        const name = String(ind?.name || '').trim()
        if (!name) continue
        const val = toNumber(ind?.value)
        if (val === null) continue
        const key = normalizeName(name)
        const prev = names.get(key)
        if (prev) prev.count += 1
        else names.set(key, { name, count: 1 })
      }
    }

    const list = Array.from(names.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
    return NextResponse.json({ indicators: list })
  } catch (e) {
    console.error('[diary-indicator-link][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения списка показателей' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const indicatorName = typeof body?.indicatorName === 'string' ? body.indicatorName.trim() : ''
    if (!indicatorName) return NextResponse.json({ error: 'indicatorName обязателен' }, { status: 400 })

    const windowDays =
      typeof body?.windowDays === 'number' && body.windowDays > 0 && body.windowDays <= 30 ? Math.floor(body.windowDays) : 7
    const limitAnalyses =
      typeof body?.limitAnalyses === 'number' && body.limitAnalyses > 0 && body.limitAnalyses <= 30 ? Math.floor(body.limitAnalyses) : 12

    const analyses = await prisma.analysis.findMany({
      where: { userId: payload.userId },
      orderBy: { date: 'desc' },
      take: 50
    })

    const targetKey = normalizeName(indicatorName)
    const points: Array<{
      analysisId: string
      title: string
      date: string
      value: number
      unit?: string
      isNormal?: boolean | null
    }> = []

    for (const a of analyses) {
      const inds = parseIndicatorsFromAnalysisResults(a.results)
      const found = inds.find((x) => normalizeName(String(x?.name || '')) === targetKey)
      if (!found) continue
      const v = toNumber(found.value)
      if (v === null) continue
      points.push({
        analysisId: a.id,
        title: a.title,
        date: a.date.toISOString(),
        value: v,
        unit: typeof found.unit === 'string' ? found.unit : undefined,
        isNormal: typeof found.isNormal === 'boolean' ? found.isNormal : null
      })
      if (points.length >= limitAnalyses) break
    }

    if (points.length < 2) {
      return NextResponse.json({
        result: {
          indicatorName,
          windowDays,
          points: [],
          correlations: [],
          tldr: 'Недостаточно точек (анализов) с этим показателем, чтобы искать связи.',
          hypotheses: [],
          dataQuality: ['Нужно хотя бы 2–3 анализа с одним и тем же показателем.']
        },
        usedLLM: false
      })
    }

    // sort ascending for window computation
    const pointsAsc = points.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const earliest = new Date(pointsAsc[0].date)
    const latest = new Date(pointsAsc[pointsAsc.length - 1].date)
    const minDiary = new Date(earliest.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const diaryEntries = await prisma.healthDiaryEntry.findMany({
      where: {
        userId: payload.userId,
        entryDate: { gte: minDiary, lte: latest }
      },
      orderBy: { entryDate: 'asc' }
    })

    const metrics = ['sleepHours', 'steps', 'pulse', 'systolic', 'diastolic', 'temperature', 'weight', 'mood', 'painScore'] as const

    // sliding window
    let left = 0
    const rows: Array<{
      analysisId: string
      analysisDate: string
      analysisTitle: string
      indicatorValue: number
      indicatorUnit?: string
      entriesCount: number
      avgs: Record<string, number | null>
    }> = []

    for (const p of pointsAsc) {
      const end = new Date(p.date).getTime()
      const start = end - windowDays * 24 * 60 * 60 * 1000
      while (left < diaryEntries.length && new Date(diaryEntries[left].entryDate).getTime() < start) left++
      let right = left
      while (right < diaryEntries.length && new Date(diaryEntries[right].entryDate).getTime() <= end) right++
      const slice = diaryEntries.slice(left, right)

      const avgs: Record<string, number | null> = {}
      for (const m of metrics) {
        const vals = slice.map((e) => toNumber((e as any)[m])).filter((x): x is number => typeof x === 'number')
        avgs[m] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }

      rows.push({
        analysisId: p.analysisId,
        analysisDate: p.date,
        analysisTitle: p.title,
        indicatorValue: p.value,
        indicatorUnit: p.unit,
        entriesCount: slice.length,
        avgs
      })
    }

    const correlations: Array<{ metric: string; r: number; n: number }> = []
    for (const m of metrics) {
      const pairs = rows
        .map((r) => ({ x: r.indicatorValue, y: r.avgs[m] }))
        .filter((p) => typeof p.y === 'number') as Array<{ x: number; y: number }>
      const xs = pairs.map((p) => p.x)
      const ys = pairs.map((p) => p.y)
      const { r, n } = pearson(xs, ys)
      if (n >= 3) correlations.push({ metric: m, r: Number(r.toFixed(3)), n })
    }
    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))

    // delta correlations: Δindicator vs Δdiary metric between adjacent analyses
    const deltaCorrelations: Array<{ metric: string; r: number; n: number }> = []
    for (const m of metrics) {
      const pairs: Array<{ x: number; y: number }> = []
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1]
        const cur = rows[i]
        const yPrev = prev.avgs[m]
        const yCur = cur.avgs[m]
        if (typeof yPrev !== 'number' || typeof yCur !== 'number') continue
        const dx = cur.indicatorValue - prev.indicatorValue
        const dy = yCur - yPrev
        pairs.push({ x: dx, y: dy })
      }
      const xs = pairs.map((p) => p.x)
      const ys = pairs.map((p) => p.y)
      const { r, n } = pearson(xs, ys)
      if (n >= 3) deltaCorrelations.push({ metric: m, r: Number(r.toFixed(3)), n })
    }
    deltaCorrelations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))

    const dataQuality: string[] = []
    if (rows.filter((r) => r.entriesCount > 0).length < 3) {
      dataQuality.push('Мало “окон” с дневниковыми записями рядом с анализами — связи могут быть случайными.')
    }
    const emptyWindows = rows.filter((r) => r.entriesCount === 0).length
    if (emptyWindows > 0) dataQuality.push(`Есть окна без записей дневника: ${emptyWindows}/${rows.length}.`)

    const top = correlations.slice(0, 4).map((c) => {
      const dir = c.r > 0 ? 'вместе растут' : 'в противофазе'
      return `"${indicatorName}" и "${c.metric}" ${dir} (r=${c.r}, n=${c.n})`
    })

    const topDelta = deltaCorrelations.slice(0, 4).map((c) => {
      const dir = c.r > 0 ? 'вместе меняются' : 'меняются в противофазе'
      return `Δ"${indicatorName}" и Δ"${c.metric}" ${dir} (r=${c.r}, n=${c.n})`
    })

    const base = {
      indicatorName,
      windowDays,
      unit: pointsAsc.find((p) => p.unit)?.unit || null,
      points: pointsAsc,
      rows,
      correlations,
      deltaCorrelations,
      tldr:
        correlations.length === 0 && deltaCorrelations.length === 0
          ? 'Недостаточно данных для устойчивых корреляций (нужно 3+ анализов с этим показателем и дневник рядом по датам).'
          : [
              correlations.length ? `Уровни (условно): ${top.join('; ')}.` : null,
              deltaCorrelations.length ? `Дельты (условно): ${topDelta.join('; ')}.` : null
            ].filter(Boolean).join('\n'),
      hypotheses: [
        {
          hypothesis: 'Изменения показателя могут “сопровождаться” изменением сна/стресса/активности, но это не доказывает причину.',
          experiment: `2 недели: фиксировать сон/активность каждый день и сдавать повторный анализ по плану врача. Сравнить показатель с недельными средними дневника.`
        },
        {
          hypothesis: 'Часть колебаний может объясняться разным временем сдачи, питанием, нагрузкой, инфекциями и т.п.',
          experiment: 'Перед следующей сдачей: одинаковые условия (время, натощак/не натощак по требованиям), отметить стресс/сон/нагрузку накануне.'
        }
      ],
      dataQuality,
      disclaimer: 'Это исследовательская подсказка, не диагноз. Корреляция ≠ причинность.'
    }

    if (!isOllamaConfigured()) {
      return NextResponse.json({ result: base, usedLLM: false })
    }

    const system = [
      'Ты — медицинский ассистент по дневнику и анализам.',
      'Твоя задача: объяснить возможные связи между выбранным лабораторным показателем и дневниковыми метриками.',
      'Важно: не делать диагностику, не утверждать причинность, давать мягкие гипотезы, предлагать безопасные эксперименты.',
      'Ответ строго JSON (json_object).'
    ].join('\n')

    const user = `Входные данные (уже посчитанные корреляции и окна дневника вокруг анализов):\n${JSON.stringify(base, null, 2)}\n\nВерни JSON с полями:\n- tldr (string)\n- keyLinks (string[] до 6)\n- hypotheses (ровно 2 объекта {hypothesis,experiment})\n- questionsToImprove (string[] до 5)\n- cautions (string[] до 5)\nНе выдумывай числа (r/n).`

    const text = await callOllamaJson(system, user)
    const parsed = JSON.parse(text)

    const merged = {
      ...base,
      tldr: typeof parsed?.tldr === 'string' ? parsed.tldr : base.tldr,
      keyLinks: Array.isArray(parsed?.keyLinks) ? parsed.keyLinks.slice(0, 6) : undefined,
      hypotheses: Array.isArray(parsed?.hypotheses) ? parsed.hypotheses.slice(0, 2) : base.hypotheses,
      questionsToImprove: Array.isArray(parsed?.questionsToImprove) ? parsed.questionsToImprove.slice(0, 5) : undefined,
      cautions: Array.isArray(parsed?.cautions) ? parsed.cautions.slice(0, 5) : undefined
    }

    return NextResponse.json({ result: merged, usedLLM: true })
  } catch (e) {
    console.error('[diary-indicator-link][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка формирования связи дневник↔показатель' }, { status: 500 })
  }
}


