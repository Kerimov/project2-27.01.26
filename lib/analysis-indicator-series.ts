export type IndicatorTrendPoint = {
  date: string
  value: number
  unit?: string
  isNormal?: boolean | null
  title?: string
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const v = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''))
    return Number.isFinite(v) ? v : null
  }
  return null
}

type IndicatorKey =
  | 'glucose'
  | 'hemoglobin'
  | 'cholesterol_total'
  | 'ldl'
  | 'hdl'
  | 'triglycerides'
  | 'creatinine'
  | 'uric_acid'
  | 'crp'
  | 'tsh'
  | 'vitamin_d'
  | 'ferritin'
  | 'wbc'
  | 'rbc'
  | 'platelets'
  | 'hematocrit'
  | 'alt'
  | 'ast'
  | string

const KEY_LABELS: Record<string, string> = {
  glucose: 'Глюкоза',
  hemoglobin: 'Гемоглобин',
  cholesterol_total: 'Холестерин общий',
  ldl: 'ЛПНП (LDL)',
  hdl: 'ЛПВП (HDL)',
  triglycerides: 'Триглицериды',
  creatinine: 'Креатинин',
  uric_acid: 'Мочевая кислота',
  crp: 'С-реактивный белок (CRP)',
  tsh: 'ТТГ (TSH)',
  vitamin_d: 'Витамин D (25-OH)',
  ferritin: 'Ферритин',
  wbc: 'Лейкоциты (WBC)',
  rbc: 'Эритроциты (RBC)',
  platelets: 'Тромбоциты (PLT)',
  hematocrit: 'Гематокрит (HCT)',
  alt: 'АЛТ (ALT)',
  ast: 'АСТ (AST)',
}

function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s./+-]/gu, '')
}

function normalizeUnit(unit?: string): string {
  return normalizeText(unit || '').replace(/\s+/g, '')
}

function indicatorKeyFromName(name: string): IndicatorKey {
  const n = normalizeText(name).replace(/\s+/g, '')

  // glucose
  if (/(^|[^a-z])glu($|[^a-z])/.test(n) || n.includes('glucose') || n.includes('глюкоз')) return 'glucose'

  // hemoglobin
  if (/(^|[^a-z])hgb($|[^a-z])/.test(n) || /(^|[^a-z])hb($|[^a-z])/.test(n) || n.includes('hemoglobin') || n.includes('гемоглобин')) {
    return 'hemoglobin'
  }

  // lipids
  if (n.includes('ldl') || n.includes('лпнп') || n.includes('липопротеинниз') || n.includes('липопротеиннизкойплот')) return 'ldl'
  if (n.includes('hdl') || n.includes('лпвп') || n.includes('липопротеинвыс') || n.includes('липопротеинвысокойплот')) return 'hdl'
  if (n.includes('triglycerid') || n.includes('триглицер')) return 'triglycerides'

  // total cholesterol (avoid catching HDL/LDL first)
  if (n.includes('cholesterol') || n.includes('холестерин') || n.includes('холест')) return 'cholesterol_total'

  // creatinine
  if (n.includes('creatinine') || n.includes('креатинин')) return 'creatinine'

  // uric acid
  if (n.includes('uricacid') || n.includes('uric') || n.includes('мочев') && n.includes('кисл')) return 'uric_acid'

  // CRP
  if (/(^|[^a-z])crp($|[^a-z])/.test(n) || n.includes('c-reactive') || n.includes('среактив')) return 'crp'

  // TSH
  if (/(^|[^a-z])tsh($|[^a-z])/.test(n) || n.includes('ттг') || n.includes('тиреотроп')) return 'tsh'

  // vitamin D 25(OH)
  if (
    n.includes('25oh') ||
    n.includes('25(oh)') ||
    n.includes('vitamind') ||
    (n.includes('витамин') && n.includes('d'))
  ) {
    return 'vitamin_d'
  }

  // ferritin
  if (n.includes('ferritin') || n.includes('ферритин')) return 'ferritin'

  // CBC core counts
  if (/(^|[^a-z])wbc($|[^a-z])/.test(n) || n.includes('лейкоц')) return 'wbc'
  if (/(^|[^a-z])rbc($|[^a-z])/.test(n) || n.includes('эритроц')) return 'rbc'
  if (n.includes('plt') || n.includes('platelet') || n.includes('тромбоц')) return 'platelets'
  if (n.includes('hct') || n.includes('hematocrit') || n.includes('гематокрит')) return 'hematocrit'

  // ALT / AST (try to avoid matching within other words)
  if (/(^|[^a-z])alt($|[^a-z])/.test(n) || n.includes('алат') || n.includes('алт')) return 'alt'
  if (/(^|[^a-z])ast($|[^a-z])/.test(n) || n.includes('асат') || n.includes('аст')) return 'ast'

  // fallback: normalized name as a stable-ish key
  return n
}

function convertValueToCanonicalUnit(
  key: IndicatorKey,
  value: number,
  unit?: string
): { value: number; unit?: string; warning?: string } {
  const u = normalizeUnit(unit)
  if (!u) return { value, unit, warning: 'Единицы не указаны' }

  // glucose: prefer mmol/L
  if (key === 'glucose') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' }
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 18, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' }
    return { value, unit, warning: `Неизвестные единицы для глюкозы: ${unit}` }
  }

  // cholesterol: prefer mmol/L
  if (key === 'cholesterol_total') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' }
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 38.67, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' }
    return { value, unit, warning: `Неизвестные единицы для холестерина: ${unit}` }
  }

  // LDL/HDL: prefer mmol/L
  if (key === 'ldl' || key === 'hdl') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' }
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 38.67, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' }
    return { value, unit, warning: `Неизвестные единицы для липидов: ${unit}` }
  }

  // triglycerides: prefer mmol/L
  if (key === 'triglycerides') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' }
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 88.57, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' }
    return { value, unit, warning: `Неизвестные единицы для триглицеридов: ${unit}` }
  }

  // creatinine: prefer µmol/L
  if (key === 'creatinine') {
    if (u === 'мкмоль/л' || u === 'umol/l' || u === 'µmol/l') return { value, unit: 'мкмоль/л' }
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value * 88.4, unit: 'мкмоль/л', warning: 'Конвертация из mg/dL в µmol/L' }
    return { value, unit, warning: `Неизвестные единицы для креатинина: ${unit}` }
  }

  // uric acid: prefer µmol/L
  if (key === 'uric_acid') {
    if (u === 'мкмоль/л' || u === 'umol/l' || u === 'µmol/l') return { value, unit: 'мкмоль/л' }
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value * 59.48, unit: 'мкмоль/л', warning: 'Конвертация из mg/dL в µmol/L' }
    return { value, unit, warning: `Неизвестные единицы для мочевой кислоты: ${unit}` }
  }

  // hemoglobin: prefer g/L
  if (key === 'hemoglobin') {
    if (u === 'г/л' || u === 'g/l') return { value, unit: 'г/л' }
    if (u === 'г/дл' || u === 'g/dl') return { value: value * 10, unit: 'г/л', warning: 'Конвертация из g/dL в g/L' }
    return { value, unit, warning: `Неизвестные единицы для гемоглобина: ${unit}` }
  }

  // CRP: prefer mg/L
  if (key === 'crp') {
    if (u === 'мг/л' || u === 'mg/l') return { value, unit: 'мг/л' }
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value * 10, unit: 'мг/л', warning: 'Конвертация из mg/dL в mg/L' }
    return { value, unit, warning: `Неизвестные единицы для CRP: ${unit}` }
  }

  // Vitamin D 25-OH: prefer nmol/L
  if (key === 'vitamin_d') {
    if (u === 'нмоль/л' || u === 'nmol/l') return { value, unit: 'нмоль/л' }
    if (u === 'нг/мл' || u === 'ng/ml') return { value: value * 2.5, unit: 'нмоль/л', warning: 'Конвертация из ng/mL в nmol/L' }
    return { value, unit, warning: `Неизвестные единицы для витамина D: ${unit}` }
  }

  // Ferritin: prefer µg/L (ng/mL is equivalent)
  if (key === 'ferritin') {
    if (u === 'мкг/л' || u === 'µg/l' || u === 'ug/l') return { value, unit: 'мкг/л' }
    if (u === 'нг/мл' || u === 'ng/ml') return { value, unit: 'мкг/л', warning: 'Нормализация единиц (ng/mL ≡ µg/L)' }
    return { value, unit, warning: `Неизвестные единицы для ферритина: ${unit}` }
  }

  // TSH: usually mIU/L
  if (key === 'tsh') {
    if (u === 'мме/л' || u === 'miu/l' || u === 'мед/л' || u === 'mu/l') return { value, unit: 'мМЕ/л' }
    return { value, unit, warning: `Единицы для ТТГ могут отличаться: ${unit}` }
  }

  // default: no conversion
  return { value, unit }
}

export function parseAnalysisResultsMap(resultsRaw: unknown): Record<
  string,
  { value: unknown; unit?: string; normal?: boolean | null }
> {
  if (!resultsRaw) return {}
  let parsed: unknown = resultsRaw
  if (typeof resultsRaw === 'string') {
    try {
      parsed = JSON.parse(resultsRaw)
    } catch {
      return {}
    }
  }

  if (typeof parsed !== 'object' || parsed === null) return {}

  const obj = parsed as Record<string, unknown>
  if (Array.isArray((obj as { indicators?: unknown }).indicators)) {
    const result: Record<string, { value: unknown; unit?: string; normal?: boolean | null }> = {}
    for (const ind of (obj as { indicators: any[] }).indicators) {
      if (ind?.name && ind.value !== undefined) {
        result[String(ind.name)] = {
          value: ind.value,
          unit: ind.unit ? String(ind.unit) : undefined,
          normal:
            typeof ind.isNormal === 'boolean'
              ? ind.isNormal
              : typeof ind.normal === 'boolean'
                ? ind.normal
                : null,
        }
      }
    }
    return result
  }

  if (Array.isArray(parsed)) {
    const result: Record<string, { value: unknown; unit?: string; normal?: boolean | null }> = {}
    for (const ind of parsed as any[]) {
      if (ind?.name && ind.value !== undefined) {
        result[String(ind.name)] = {
          value: ind.value,
          unit: ind.unit ? String(ind.unit) : undefined,
          normal:
            typeof ind.isNormal === 'boolean'
              ? ind.isNormal
              : typeof ind.normal === 'boolean'
                ? ind.normal
                : null,
        }
      }
    }
    return result
  }

  const result: Record<string, { value: unknown; unit?: string; normal?: boolean | null }> = {}
  for (const [name, v] of Object.entries(obj)) {
    if (name === 'findings' || name === 'rawTextLength' || name === 'indicators') continue
    if (v && typeof v === 'object' && 'value' in (v as object)) {
      const row = v as { value?: unknown; unit?: string; isNormal?: boolean; normal?: boolean }
      result[name] = {
        value: row.value,
        unit: row.unit,
        normal:
          typeof row.isNormal === 'boolean'
            ? row.isNormal
            : typeof row.normal === 'boolean'
              ? row.normal
              : null,
      }
    }
  }
  return result
}

export function pickDefaultIndicatorName(resultsRaw: unknown): string | null {
  const map = parseAnalysisResultsMap(resultsRaw)
  const names = Object.keys(map)
  if (names.length === 0) return null

  const abnormal = names.find((name) => {
    const row = map[name]
    return row?.normal === false
  })
  if (abnormal) return abnormal

  const numeric = names.find((name) => toNumber(map[name]?.value) !== null)
  return numeric || names[0]
}

export function getNumericIndicatorNames(resultsRaw: unknown): string[] {
  const map = parseAnalysisResultsMap(resultsRaw)
  return Object.keys(map).filter((name) => toNumber(map[name]?.value) !== null)
}

export function getCommonIndicatorNames(
  analyses: Array<{ results: unknown }>
): string[] {
  if (analyses.length === 0) return []
  const perAnalysis = analyses.map((a) => new Set(getNumericIndicatorNames(a.results)))
  const [first, ...rest] = perAnalysis
  const common = [...first].filter((name) => rest.every((set) => set.has(name)))
  return common.sort((a, b) => a.localeCompare(b, 'ru'))
}

export type CommonIndicatorGroup = {
  key: IndicatorKey
  label: string
  variants: string[]
  warnings?: string[]
}

export type ProbableIndicatorGroup = {
  key: string
  label: string
  confidence: number // 0..1
  variants: string[]
  perAnalysisNameByIndex: Record<number, string>
  warnings: string[]
}

export function getCommonIndicatorGroups(
  analyses: Array<{ results: unknown }>
): CommonIndicatorGroup[] {
  if (analyses.length === 0) return []

  const per = analyses.map((a) => {
    const map = parseAnalysisResultsMap(a.results)
    const entries = Object.entries(map)
      .map(([name, row]) => ({ name, row, num: toNumber(row.value) }))
      .filter((x) => x.num !== null) as Array<{ name: string; row: { value: unknown; unit?: string; normal?: boolean | null }; num: number }>

    const keyToNames = new Map<IndicatorKey, string[]>()
    for (const e of entries) {
      const key = indicatorKeyFromName(e.name)
      const arr = keyToNames.get(key) || []
      arr.push(e.name)
      keyToNames.set(key, arr)
    }
    return keyToNames
  })

  const keys0 = new Set(per[0].keys())
  const commonKeys = [...keys0].filter((k) => per.slice(1).every((m) => m.has(k)))

  const groups: CommonIndicatorGroup[] = commonKeys.map((key) => {
    const variants = new Set<string>()
    for (const m of per) {
      for (const name of m.get(key) || []) variants.add(name)
    }
    const label = KEY_LABELS[key] || [...variants][0] || String(key)
    return { key, label, variants: [...variants].sort((a, b) => a.localeCompare(b, 'ru')) }
  })

  return groups.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

function tokenSet(s: string): Set<string> {
  const t = normalizeText(s)
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 3)
  return new Set(t)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

function similarityName(a: string, b: string): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.92
  const ta = tokenSet(na)
  const tb = tokenSet(nb)
  const jac = jaccard(ta, tb)
  return jac
}

export function suggestProbableCommonGroups(
  analyses: Array<{ results: unknown }>,
  opts?: { minConfidence?: number; limit?: number }
): ProbableIndicatorGroup[] {
  const minConfidence = opts?.minConfidence ?? 0.66
  const limit = opts?.limit ?? 8
  if (analyses.length < 2) return []

  const perAnalysisNames = analyses.map((a) => {
    const map = parseAnalysisResultsMap(a.results)
    return Object.entries(map)
      .map(([name, row]) => ({ name, num: toNumber(row.value) }))
      .filter((x) => x.num !== null)
      .map((x) => x.name)
  })

  const seeds = perAnalysisNames[0] || []
  const usedByAnalysis = perAnalysisNames.map(() => new Set<string>())

  const out: ProbableIndicatorGroup[] = []

  for (const seed of seeds) {
    const per: Record<number, string> = { 0: seed }
    let confSum = 0
    let ok = true

    for (let i = 1; i < perAnalysisNames.length; i++) {
      const candidates = perAnalysisNames[i].filter((n) => !usedByAnalysis[i].has(n))
      let bestName = ''
      let bestScore = 0
      for (const c of candidates) {
        const s = similarityName(seed, c)
        if (s > bestScore) {
          bestScore = s
          bestName = c
        }
      }
      if (!bestName || bestScore < minConfidence) {
        ok = false
        break
      }
      per[i] = bestName
      confSum += bestScore
    }

    if (!ok) continue

    const avg = confSum / Math.max(1, perAnalysisNames.length - 1)
    const variants = Object.values(per)
    for (const [idx, name] of Object.entries(per)) usedByAnalysis[Number(idx)].add(name)

    const key = `prob:${normalizeText(seed).replace(/\s+/g, '_').slice(0, 60)}`
    out.push({
      key,
      label: variants[0],
      confidence: Math.max(0, Math.min(1, avg)),
      variants: [...new Set(variants)].sort((a, b) => a.localeCompare(b, 'ru')),
      perAnalysisNameByIndex: per,
      warnings: ['Вероятное совпадение по названию. Проверьте, что это один и тот же показатель.'],
    })

    if (out.length >= limit) break
  }

  return out.sort((a, b) => b.confidence - a.confidence)
}

export function buildIndicatorSeriesByKey(
  analyses: Array<{ date: Date | string; title: string; results: unknown }>,
  indicatorKey: IndicatorKey
): { series: IndicatorTrendPoint[]; warnings: string[]; matchedNames: string[] } {
  const warnings: string[] = []
  const matchedNames: string[] = []
  const points: IndicatorTrendPoint[] = []

  for (const a of analyses) {
    const map = parseAnalysisResultsMap(a.results)
    // pick best matching name by key
    const candidates = Object.keys(map).filter((name) => indicatorKeyFromName(name) === indicatorKey)
    const pick = candidates[0]
    if (!pick) continue
    const row = map[pick]
    const num = toNumber(row?.value)
    if (num === null) continue

    const conv = convertValueToCanonicalUnit(indicatorKey, num, row?.unit)
    if (conv.warning) warnings.push(`${a.title}: ${conv.warning}`)
    matchedNames.push(pick)

    const date =
      a.date instanceof Date ? a.date.toISOString() : new Date(String(a.date)).toISOString()
    points.push({
      date,
      value: conv.value,
      unit: conv.unit,
      isNormal: typeof row.normal === 'boolean' ? row.normal : null,
      title: a.title,
    })
  }

  return {
    series: points.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime()),
    warnings: [...new Set(warnings)].slice(0, 10),
    matchedNames: [...new Set(matchedNames)],
  }
}

export function buildIndicatorSeriesByNameMap(
  analyses: Array<{ date: Date | string; title: string; results: unknown }>,
  nameByIndex: Record<number, string>
): { series: IndicatorTrendPoint[]; warnings: string[]; matchedNames: string[] } {
  const warnings: string[] = []
  const matchedNames: string[] = []
  const points: IndicatorTrendPoint[] = []

  for (let idx = 0; idx < analyses.length; idx++) {
    const a = analyses[idx]
    const wanted = nameByIndex[idx]
    if (!wanted) continue
    const map = parseAnalysisResultsMap(a.results)
    const row = map[wanted]
    if (!row) {
      warnings.push(`${a.title}: не найдено «${wanted}»`)
      continue
    }
    const num = toNumber(row.value)
    if (num === null) continue
    matchedNames.push(wanted)
    const date =
      a.date instanceof Date ? a.date.toISOString() : new Date(String(a.date)).toISOString()
    points.push({
      date,
      value: num,
      unit: row.unit,
      isNormal: typeof row.normal === 'boolean' ? row.normal : null,
      title: a.title,
    })
  }

  return {
    series: points.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime()),
    warnings: [...new Set(warnings)].slice(0, 10),
    matchedNames: [...new Set(matchedNames)],
  }
}

export function buildIndicatorSeries(
  analyses: Array<{ date: Date | string; title: string; results: unknown }>,
  indicatorName: string
): IndicatorTrendPoint[] {
  const points: IndicatorTrendPoint[] = []
  for (const a of analyses) {
    const map = parseAnalysisResultsMap(a.results)
    const row = map[indicatorName]
    if (!row) continue
    const num = toNumber(row.value)
    if (num === null) continue
    const date =
      a.date instanceof Date ? a.date.toISOString() : new Date(String(a.date)).toISOString()
    points.push({
      date,
      value: num,
      unit: row.unit,
      isNormal: typeof row.normal === 'boolean' ? row.normal : null,
      title: a.title,
    })
  }
  return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}
