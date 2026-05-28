import { getDocument, reprocessDocument, type DocumentDetail } from '../api/documents';
import { sendAIMessage } from '../api/ai';

export const CHAT_DOCUMENT_ANALYZE_PROMPT =
  'Разбери прикреплённый медицинский документ: перечисли показатели, отметь отклонения от нормы, опиши возможные причины (без диагноза) и что обсудить с врачом.';

export async function pollDocumentUntilParsedMobile(
  documentId: string,
  maxAttempts = 90
): Promise<DocumentDetail | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const doc = await getDocument(documentId);
      if (doc.parsed) return doc;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  try {
    return await getDocument(documentId);
  } catch {
    return null;
  }
}

export function formatDocumentOcrSummaryMobile(doc: DocumentDetail): string {
  const lines: string[] = [];
  const date = doc.studyDate ? new Date(doc.studyDate).toLocaleDateString('ru-RU') : null;
  lines.push(`${doc.fileName}${doc.studyType ? ` — ${doc.studyType}` : ''}${date ? ` (${date})` : ''}`);
  if (doc.laboratory) lines.push(`Лаборатория: ${doc.laboratory}`);
  if (doc.ocrConfidence != null) lines.push(`OCR: ${Math.round(doc.ocrConfidence * 100)}%`);

  const inds = Array.isArray(doc.indicators) ? doc.indicators : [];
  if (inds.length > 0) {
    lines.push('\nПоказатели:');
    for (const i of inds.slice(0, 40)) {
      const flag = i.isNormal === false ? ' ⚠️' : i.isNormal === true ? ' ✅' : '';
      lines.push(`- ${i.name}: ${i.value}${i.unit ? ` ${i.unit}` : ''}${flag}`);
    }
  } else if (doc.findings) {
    lines.push(`\n${String(doc.findings).slice(0, 1000)}`);
  } else if (!doc.parsed) {
    lines.push('\nРаспознавание не завершено.');
  }
  return lines.join('\n');
}

export async function requestDocumentAnalysisInChat(documentIds: string[]) {
  return sendAIMessage({
    message: CHAT_DOCUMENT_ANALYZE_PROMPT,
    documentIds,
    ragScope: 'attached',
  });
}
