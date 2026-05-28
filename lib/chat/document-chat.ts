/** Утилиты чата: ожидание OCR и текстовая сводка документа */

export type DocumentForChat = {
  id: string
  fileName: string
  parsed?: boolean
  studyType?: string | null
  laboratory?: string | null
  studyDate?: string | Date | null
  findings?: string | null
  rawText?: string | null
  ocrConfidence?: number | null
  indicators?: unknown
}

export async function pollDocumentUntilParsed(
  documentId: string,
  options?: { intervalMs?: number; maxAttempts?: number; fetchDoc?: (id: string) => Promise<DocumentForChat | null> }
): Promise<DocumentForChat | null> {
  const intervalMs = options?.intervalMs ?? 2000
  const maxAttempts = options?.maxAttempts ?? 90
  const fetchDoc =
    options?.fetchDoc ??
    (async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { credentials: 'include' })
      if (!res.ok) return null
      const data = await res.json().catch(() => ({}))
      return data.document as DocumentForChat
    })

  for (let i = 0; i < maxAttempts; i++) {
    const doc = await fetchDoc(documentId)
    if (doc?.parsed) return doc
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return fetchDoc(documentId)
}

function parseIndicators(indicators: unknown): Array<{
  name: string
  value: string
  unit?: string
  isNormal?: boolean | null
}> {
  if (!indicators) return []
  if (Array.isArray(indicators)) {
    return indicators
      .filter((i) => i && typeof i === 'object' && (i as any).name)
      .map((i: any) => ({
        name: String(i.name),
        value: String(i.value ?? '—'),
        unit: i.unit ? String(i.unit) : undefined,
        isNormal: i.isNormal ?? i.normal ?? null,
      }))
  }
  if (typeof indicators === 'object') {
    return Object.entries(indicators as Record<string, any>).map(([name, v]) => ({
      name,
      value: String(v?.value ?? '—'),
      unit: v?.unit ? String(v.unit) : undefined,
      isNormal: v?.isNormal ?? v?.normal ?? null,
    }))
  }
  return []
}

export function formatDocumentOcrSummary(doc: DocumentForChat): string {
  const lines: string[] = []
  const date = doc.studyDate ? new Date(doc.studyDate).toLocaleDateString('ru-RU') : null
  lines.push(`**${doc.fileName}**${doc.studyType ? ` — ${doc.studyType}` : ''}${date ? ` (${date})` : ''}`)
  if (doc.laboratory) lines.push(`Лаборатория: ${doc.laboratory}`)
  if (doc.ocrConfidence != null) {
    lines.push(`Уверенность OCR: ${Math.round(doc.ocrConfidence * 100)}%`)
  }

  const inds = parseIndicators(doc.indicators)
  if (inds.length > 0) {
    lines.push('\n**Показатели:**')
    for (const i of inds.slice(0, 40)) {
      const flag = i.isNormal === false ? ' ⚠️ вне нормы' : i.isNormal === true ? ' ✅' : ''
      const unit = i.unit ? ` ${i.unit}` : ''
      lines.push(`- ${i.name}: ${i.value}${unit}${flag}`)
    }
    if (inds.length > 40) lines.push(`… и ещё ${inds.length - 40} показателей`)
  } else if (doc.findings) {
    lines.push(`\n${String(doc.findings).slice(0, 1200)}`)
  } else if (doc.rawText) {
    lines.push(`\n${String(doc.rawText).slice(0, 800)}…`)
  } else if (!doc.parsed) {
    lines.push('\nРаспознавание ещё не завершено.')
  } else {
    lines.push('\nТекст распознан, но показатели не извлечены. Откройте документ для ручной правки.')
  }

  return lines.join('\n')
}

export const CHAT_DOCUMENT_ANALYZE_PROMPT =
  'Разбери прикреплённый медицинский документ: перечисли показатели, отметь отклонения от нормы, опиши возможные причины (без диагноза) и что обсудить с врачом. Если создан анализ в кабинете — укажи на это.'
