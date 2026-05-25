/**
 * OCR PDF через Tesseract: рендер страниц (pdf-to-img) + распознавание (tesseract.js).
 * Используется, когда OCR.space недоступен из‑за лимита размера (~1 MB).
 */

import { pdf } from 'pdf-to-img'
import { createWorker, PSM } from 'tesseract.js'

import type { OCRResult } from './ocr'

const MAX_PDF_PAGES = Number(process.env.TESSERACT_PDF_MAX_PAGES || 20)
const PDF_RENDER_SCALE = Number(process.env.TESSERACT_PDF_SCALE || 2)

function toPdfInput(fileUrlOrBuffer: string | Buffer): string | Buffer {
  if (Buffer.isBuffer(fileUrlOrBuffer)) return fileUrlOrBuffer
  const match = fileUrlOrBuffer.match(/^data:[^;]+;base64,(.+)$/s)
  if (match) {
    return Buffer.from(match[1], 'base64')
  }
  return fileUrlOrBuffer
}

export async function performTesseractPdfOCR(fileUrlOrBuffer: string | Buffer): Promise<OCRResult> {
  console.log('[Tesseract PDF] Starting PDF OCR (pdf-to-img + tesseract.js)...')

  const input = toPdfInput(fileUrlOrBuffer)
  const doc = await pdf(input, { scale: PDF_RENDER_SCALE })

  const worker = await createWorker('rus+eng')
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO_OSD,
    preserve_interword_spaces: '1',
  })

  const pageTexts: string[] = []
  let confidenceSum = 0
  let processedPages = 0

  try {
    let pageNum = 0
    const totalPages = doc.length

    for await (const pageBuffer of doc) {
      pageNum++
      if (pageNum > MAX_PDF_PAGES) {
        pageTexts.push(`\n--- (страницы после ${MAX_PDF_PAGES} не обработаны) ---\n`)
        break
      }

      console.log(`[Tesseract PDF] Page ${pageNum}/${totalPages}...`)
      const pngDataUrl = `data:image/png;base64,${pageBuffer.toString('base64')}`
      const { data } = await worker.recognize(pngDataUrl)

      const chunk = (data.text || '').trim()
      if (chunk) {
        pageTexts.push(totalPages > 1 ? `--- Страница ${pageNum} ---\n${chunk}` : chunk)
      }
      confidenceSum += data.confidence
      processedPages++
    }
  } finally {
    await worker.terminate()
    await doc.destroy()
  }

  const text = pageTexts.join('\n\n').trim()
  if (!text) {
    throw new Error('Tesseract PDF: текст не извлечён')
  }

  console.log(
    `[Tesseract PDF] Done: ${processedPages} page(s), ${text.length} chars, avg confidence ${processedPages ? (confidenceSum / processedPages).toFixed(1) : 0}%`
  )

  return {
    text,
    confidence: processedPages > 0 ? confidenceSum / processedPages / 100 : 0.55,
  }
}
