// OCR.space API - бесплатный OCR сервис
// 25,000 запросов/месяц бесплатно

import { logger } from './logger'

export interface OCRSpaceResult {
  text: string
  confidence: number
}

/** OCR.space Free: ~1 MB на файл */
export const OCR_SPACE_MAX_BYTES = 1024 * 1024

export function approximateDataUrlBytes(fileUrl: string): number {
  const rawLen = fileUrl.includes(',') ? fileUrl.split(',')[1].length : fileUrl.length
  return Math.floor((rawLen * 3) / 4)
}

export function isFileTooLargeForOcrSpace(fileUrl: string): boolean {
  return approximateDataUrlBytes(fileUrl) > OCR_SPACE_MAX_BYTES
}

export function isOcrSpaceSizeError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('FILE_TOO_LARGE_FOR_OCR_SPACE') ||
    /file size|too large|exceeds.*limit|E216/i.test(msg)
  )
}

/** Бесплатный OCR.space: максимум 3 страницы в PDF */
export function isOcrSpacePageLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /page|страниц|E213|E214|E215/i.test(msg)
}

export function describeOcrSpaceLimits(): string {
  return `лимит OCR.space Free: файл до ${OCR_SPACE_MAX_BYTES / 1024} KB, PDF до 3 страниц, ~500 запросов/день`
}

function prepareOcrSpacePayload(fileUrlOrBase64: string): { base64Image: string; filetype?: string } {
  const match = fileUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/s)
  if (!match) {
    return { base64Image: fileUrlOrBase64 }
  }
  const mime = match[1].toLowerCase()
  const base64 = match[2]
  const dataUri = `data:${mime};base64,${base64}`
  if (mime.includes('pdf')) return { base64Image: dataUri, filetype: 'PDF' }
  if (mime.includes('png')) return { base64Image: dataUri, filetype: 'PNG' }
  return { base64Image: dataUri, filetype: 'JPG' }
}

async function callOcrSpaceApi(
  base64Image: string,
  filetype: string | undefined,
  engine: '1' | '2'
): Promise<{ text: string; confidence: number; engine: string }> {
  const formData = new FormData()
  formData.append('base64Image', base64Image)
  formData.append('language', 'rus')
  formData.append('isOverlayRequired', 'false')
  formData.append('detectOrientation', 'true')
  formData.append('scale', 'true')
  formData.append('OCREngine', engine)
  if (filetype) formData.append('filetype', filetype)

  const apiKey = process.env.OCR_SPACE_API_KEY || 'helloworld'

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { apikey: apiKey },
    body: formData,
    signal: AbortSignal.timeout(120_000),
  })

  const data = await response.json()
  const results: any[] = Array.isArray(data.ParsedResults) ? data.ParsedResults : []

  logger.info('OCR.space response', 'OCR.space', {
    engine,
    hasResults: !!data.ParsedResults,
    resultsCount: results.length,
    isErrored: data.IsErroredOnProcessing,
    errorMessage: data.ErrorMessage,
  })

  const pageTexts = results.map((r, index) => {
    const pageText = r?.ParsedText || ''
    if (results.length > 1 && pageText.trim()) {
      return `\n--- Страница ${index + 1} ---\n${pageText}`
    }
    return pageText
  })
  const combinedText = pageTexts.join('\n\n')

  const exitCodes = results.map((r) => r?.FileParseExitCode).filter((c: unknown) => typeof c !== 'undefined')
  const exitCode = exitCodes.length > 0 && exitCodes.every((c: number) => c === 1) ? 1 : 0

  if (data.IsErroredOnProcessing && combinedText.length === 0) {
    const errorMsg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join('; ')
      : data.ErrorMessage || data.ErrorDetails || 'OCR processing failed'
    throw new Error(`OCR.space engine ${engine}: ${errorMsg}`)
  }

  if (combinedText.length > 0) {
    return {
      text: combinedText,
      confidence: exitCode === 1 ? 0.85 : 0.7,
      engine,
    }
  }

  throw new Error(`OCR.space engine ${engine}: текст не извлечён`)
}

export async function performOCRSpace(imageBase64: string): Promise<OCRSpaceResult> {
  const { base64Image, filetype } = prepareOcrSpacePayload(imageBase64)
  const approxBytes = approximateDataUrlBytes(base64Image)
  logger.info('Starting text recognition', 'OCR.space', {
    filetype: filetype || 'image',
    approxKb: Math.round(approxBytes / 1024),
    withinSizeLimit: approxBytes <= OCR_SPACE_MAX_BYTES,
  })

  if (approxBytes > OCR_SPACE_MAX_BYTES) {
    throw new Error(
      `FILE_TOO_LARGE_FOR_OCR_SPACE (${Math.round(approxBytes / 1024)} KB > ${OCR_SPACE_MAX_BYTES / 1024} KB). Сожмите файл или используйте Pro API.`
    )
  }

  // PDF — надёжнее Engine 1; для фото сначала 2, при ошибке — 1
  const engines: Array<'1' | '2'> = filetype === 'PDF' ? ['1', '2'] : ['2', '1']
  let lastError: Error | null = null

  for (const engine of engines) {
    try {
      const result = await callOcrSpaceApi(base64Image, filetype, engine)
      logger.info('Recognition completed', 'OCR.space', {
        engine: result.engine,
        textLength: result.text.length,
      })
      return { text: result.text, confidence: result.confidence }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      logger.warn('OCR.space engine failed, trying next', 'OCR.space', {
        engine,
        error: lastError.message,
      })
    }
  }

  throw lastError || new Error('OCR.space: все движки не распознали документ')
}

