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
