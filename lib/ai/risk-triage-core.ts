export type RiskLevel = 'ok' | 'attention' | 'urgent'

export function extractIndicatorsFromResults(resultsJson: unknown): Array<{
  name: string
  value: unknown
  unit?: string
  referenceMin?: number | null
  referenceMax?: number | null
  isNormal?: boolean | null
}> {
  if (!resultsJson) return []
  let parsed: any = resultsJson
  if (typeof resultsJson === 'string') {
    try {
      parsed = JSON.parse(resultsJson)
    } catch {
      return []
    }
  }
  if (Array.isArray(parsed?.indicators)) return parsed.indicators
  if (Array.isArray(parsed)) return parsed
  if (typeof parsed === 'object') {
    return Object.entries(parsed).map(([name, v]: [string, any]) => ({
      name,
      value: v?.value ?? '',
      unit: v?.unit,
      referenceMin: v?.referenceMin ?? null,
      referenceMax: v?.referenceMax ?? null,
      isNormal: v?.isNormal ?? v?.normal ?? null,
    }))
  }
  return []
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizeText(s: string) {
  return (s || '').toLowerCase().replace(/ё/g, 'е')
}

export function ruleBasedTriage(params: {
  analysisStatus?: string
  indicators: Array<{ name?: string; isNormal?: boolean | null }>
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
    reasons.push('Статус анализа отмечен как «критично».')
  } else if (status === 'abnormal') {
    level = 'attention'
    reasons.push('Статус анализа отмечен как «отклонение».')
  } else if (abnormal.length > 0) {
    level = 'attention'
    reasons.push(`Есть отклонения: ${abnormal.slice(0, 6).map((x) => x.name).join(', ')}.`)
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
    'температура 40',
  ]
  if (sx && urgentSx.some((k) => sx.includes(k))) {
    level = 'urgent'
    reasons.push('Описанные симптомы могут требовать срочной помощи.')
    redFlags.push('При боли в груди, выраженной одышке, потере сознания — вызывайте скорую (103/112).')
  }

  if (level === 'ok') {
    nextSteps.push('При симптомах обсудите результаты с врачом.')
  } else if (level === 'attention') {
    nextSteps.push('Запишитесь к врачу для интерпретации отклонений.')
  } else {
    nextSteps.push('При опасных симптомах — скорая (103/112).')
  }

  let conf = 35
  if (status === 'critical') conf += 25
  if (abnormal.length > 0) conf += 10
  if ((params.indicators || []).length >= 10) conf += 10
  if (sx) conf += 5
  conf = clamp(conf, 15, 80)

  return { level, reasons, confidence: conf, redFlags, nextSteps }
}

export function formatTriageLevelRu(level: RiskLevel): string {
  if (level === 'urgent') return 'срочно к врачу / неотложная помощь'
  if (level === 'attention') return 'требует внимания в ближайшую неделю'
  return 'в пределах нормы / наблюдение'
}
