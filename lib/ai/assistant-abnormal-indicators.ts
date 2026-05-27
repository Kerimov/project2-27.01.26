import { prisma } from '@/lib/db'
import { parseAnalysisResultsMap } from '@/lib/analysis-indicator-series'

export type AbnormalIndicatorRow = {
  analysisId: string
  analysisTitle: string
  analysisDate: string
  indicatorName: string
  value: string
  unit?: string
}

export async function collectUserAbnormalIndicators(userId: string, limit = 80): Promise<AbnormalIndicatorRow[]> {
  const analyses = await prisma.analysis.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 40,
    select: { id: true, title: true, date: true, results: true, status: true },
  })

  const rows: AbnormalIndicatorRow[] = []

  for (const a of analyses) {
    const map = parseAnalysisResultsMap(a.results)
    const dateIso =
      a.date instanceof Date ? a.date.toISOString() : new Date(String(a.date)).toISOString()

    for (const [name, row] of Object.entries(map)) {
      if (row.normal !== false) continue
      rows.push({
        analysisId: a.id,
        analysisTitle: a.title || 'Анализ',
        analysisDate: dateIso,
        indicatorName: name,
        value: String(row.value ?? '—'),
        unit: row.unit,
      })
      if (rows.length >= limit) return rows
    }
  }

  return rows
}

export function formatAbnormalIndicatorsForChat(rows: AbnormalIndicatorRow[]): string {
  if (rows.length === 0) {
    return 'По загруженным анализам отклонений от нормы не найдено (или показатели ещё не распознаны).'
  }

  const lines = rows.map((r, i) => {
    const dateStr = new Date(r.analysisDate).toLocaleDateString('ru-RU')
    const unit = r.unit ? ` ${r.unit}` : ''
    return `${i + 1}. ${r.indicatorName}: ${r.value}${unit} — «${r.analysisTitle}» (${dateStr})`
  })

  return `Показатели вне нормы (${rows.length}):\n${lines.join('\n')}`
}
