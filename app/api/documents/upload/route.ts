import { NextRequest, NextResponse } from 'next/server'
import { DocumentCategory } from '@/lib/documents'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { isResolvePatientErr, resolvePatientId } from '@/lib/caretaker-access'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { parse as parseCookies } from 'cookie'
import { waitUntil } from '@vercel/functions'

export const runtime = 'nodejs'
export const maxDuration = 300
// Использует headers/cookies, помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

// Размер файла в байтах (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Разрешенные типы файлов
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/dicom',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const token = getToken(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Неверный токен' },
        { status: 401 }
      )
    }

    // Получаем файл
    const formData = await request.formData()
    const file = formData.get('file') as File
    const targetPatientId = (formData.get('patientId') as string) || ''

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не найден' },
        { status: 400 }
      )
    }

    // Проверка размера
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Размер файла превышает ${MAX_FILE_SIZE / 1024 / 1024} МБ` },
        { status: 400 }
      )
    }

    // Проверка типа
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Неподдерживаемый тип файла' },
        { status: 400 }
      )
    }

    // Конвертируем файл в base64 для хранения
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const fileUrl = `data:${file.type};base64,${base64}`

    // Определяем категорию по типу файла
    let category: DocumentCategory = DocumentCategory.OTHER
    if (file.type.includes('image') || file.type.includes('dicom')) {
      category = DocumentCategory.IMAGING
    }

    // Определяем пользователя-владельца документа
    let ownerUserId = payload.userId
    if (targetPatientId && targetPatientId !== payload.userId) {
      if ((payload as any).role === 'DOCTOR') {
        const doctor = await prisma.doctorProfile.findUnique({ where: { userId: payload.userId } })
        if (doctor) {
          const [hasRecord, hasAppointment] = await Promise.all([
            prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId: targetPatientId }, select: { id: true } }),
            prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId: targetPatientId }, select: { id: true } }),
          ])
          if (hasRecord || hasAppointment) {
            ownerUserId = targetPatientId
          }
        }
      } else {
        const resolved = await resolvePatientId({
          payload,
          requestedPatientId: targetPatientId,
          capability: 'diary_write',
        })
        if (isResolvePatientErr(resolved)) {
          return NextResponse.json({ error: resolved.error }, { status: resolved.status })
        }
        ownerUserId = resolved.patientId
      }
    }

    // Создаем документ
    const document = await prisma.document.create({
      data: {
        userId: ownerUserId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl,
        parsed: false,
        category
      }
    })

    // Vercel serverless может оборвать обычный "fire-and-forget" promise после ответа.
    waitUntil(processDocumentOCR(document.id))

    return NextResponse.json({
      message: 'Файл успешно загружен',
      document: {
        id: document.id,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadDate: document.uploadDate
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Ошибка загрузки файла' },
      { status: 500 }
    )
  }
}

const OCR_PROCESS_TIMEOUT_MS = 180_000

async function resolveAIConfigForOCR() {
  const { getAIConfig } = await import('@/lib/ai-medical-parser')
  const { isOllamaReachable } = await import('@/lib/ollama')
  const config = await getAIConfig()
  if (!config) return null
  if (config.provider === 'ollama') {
    const reachable = await isOllamaReachable()
    if (!reachable) {
      console.warn('[OCR] Ollama не запущена (ollama serve) — парсинг без AI')
      return null
    }
  }
  return config
}

/** Сохранить распознанный текст и распарсить показатели (общий шаг для OCR.space / Tesseract / Vision) */
async function persistOcrResult(
  documentId: string,
  ocrResult: { text: string; confidence: number },
  sourceLabel: string
) {
  const { parseMedicalData } = await import('@/lib/ocr')
  const { parseWithAI } = await import('@/lib/ai-medical-parser')

  let medicalData
  const aiConfig = await resolveAIConfigForOCR()

  if (aiConfig) {
    try {
      console.log(`[OCR] Using AI parser (${aiConfig.provider}) after ${sourceLabel}...`)
      medicalData = await parseWithAI(ocrResult.text, aiConfig)
    } catch (aiError) {
      console.warn('[OCR] AI parsing failed, falling back to regex:', aiError)
      medicalData = parseMedicalData(ocrResult.text)
    }
    try {
      const regexData = parseMedicalData(ocrResult.text)
      if (regexData?.indicators?.length) {
        const byName = new Map<string, any>()
        ;(medicalData?.indicators || []).forEach((i: any) => i?.name && byName.set(i.name.toLowerCase(), i))
        regexData.indicators.forEach((i: any) => {
          const key = i?.name?.toLowerCase()
          if (key && !byName.has(key)) byName.set(key, i)
        })
        medicalData.indicators = Array.from(byName.values())
      }
    } catch (mergeErr) {
      console.warn('[OCR] Unable to merge AI and regex indicators:', mergeErr)
    }
  } else {
    medicalData = parseMedicalData(ocrResult.text)
  }

  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        rawText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        studyType: medicalData.studyType,
        studyDate: medicalData.studyDate,
        laboratory: medicalData.laboratory,
        doctor: medicalData.doctor,
        findings: medicalData.findings,
        indicators: medicalData.indicators ?? undefined,
        parsed: true,
      },
    })
    await saveAnalysisFromDocument(documentId).catch((err) => {
      console.error(`[OCR] saveAnalysisFromDocument error for ${documentId}:`, err)
    })
    console.log(`[OCR] ${sourceLabel} completed successfully for document ${documentId}`)
  } catch (e: any) {
    if (e?.code === 'P2025') {
      console.warn(`[OCR] Document ${documentId} was removed before update (${sourceLabel}). Skipping.`)
      return
    }
    throw e
  }
}

async function tryTesseractPdfOcr(documentId: string, fileUrl: string): Promise<boolean> {
  try {
    const { performTesseractPdfOCR } = await import('@/lib/pdf-tesseract')
    const ocrResult = await performTesseractPdfOCR(fileUrl)
    await persistOcrResult(documentId, ocrResult, 'Tesseract PDF')
    return true
  } catch (e) {
    console.error('[OCR] Tesseract PDF failed:', e)
    return false
  }
}

async function applyMockOcrResult(documentId: string, reason?: string) {
  const note = reason
    ? `OCR завершён с демо-данными: ${reason}`
    : 'Демонстрационные данные. Для реального распознавания проверьте OCR_SPACE_API_KEY и Ollama.'
  const mockData = {
    rawText: note,
    ocrConfidence: 0.5,
    studyType: 'Общий анализ крови',
    studyDate: new Date(),
    laboratory: 'Demo-Lab',
    doctor: 'Demo Doctor',
    findings: note,
    parsed: true,
    indicators: [
      { name: 'Гемоглобин (HGB)', value: 140, unit: 'г/л', referenceMin: 120, referenceMax: 160, isNormal: true },
      { name: 'Лейкоциты (WBC)', value: 6.0, unit: 'тыс/мкл', referenceMin: 4.0, referenceMax: 9.0, isNormal: true },
    ],
  }
  try {
    await prisma.document.update({ where: { id: documentId }, data: mockData })
    await saveAnalysisFromDocument(documentId).catch((err) => {
      console.error(`[OCR] saveAnalysisFromDocument mock error for ${documentId}:`, err)
    })
    console.warn(`[OCR] Mock/fallback saved for document ${documentId}`)
  } catch (e: any) {
    if (e?.code === 'P2025') return
    throw e
  }
}

// Асинхронная обработка OCR — всегда завершается (parsed=true), иначе в приложении «Обрабатывается…» бесконечно
async function processDocumentOCR(documentId: string) {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('OCR_TIMEOUT')), OCR_PROCESS_TIMEOUT_MS)
  })
  try {
    await Promise.race([processDocumentOCRInner(documentId), timeout])
  } catch (error) {
    console.error(`[OCR] Pipeline failed for ${documentId}:`, error)
    await applyMockOcrResult(
      documentId,
      error instanceof Error ? error.message : 'unknown error'
    )
  }
}

async function processDocumentOCRInner(documentId: string) {
  console.log(`[OCR] Starting processing for document ${documentId}`)

  const document = await prisma.document.findUnique({ where: { id: documentId } })
  if (!document) return

  const isImage = document.fileType.includes('image')
  const isPDF = document.fileType.includes('pdf')

  if (!isImage && !isPDF) {
    console.log(`[OCR] Unsupported file type: ${document.fileType}`)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        parsed: true,
        rawText: '',
        ocrConfidence: 0,
        findings: `Тип «${document.fileType}» не поддерживается для автоматического OCR.`,
      },
    })
    return
  }

  const {
    performOCRSpace,
    isFileTooLargeForOcrSpace,
    isOcrSpaceSizeError,
    isOcrSpacePageLimitError,
    describeOcrSpaceLimits,
    approximateDataUrlBytes,
    OCR_SPACE_MAX_BYTES,
  } = await import('@/lib/ocr-space')
  const storedKb = Math.round(approximateDataUrlBytes(document.fileUrl) / 1024)
  console.log(
    `[OCR] ${document.fileName}: fileSize=${document.fileSize} B, data-url≈${storedKb} KB, type=${document.fileType}`
  )

  if (isPDF && isFileTooLargeForOcrSpace(document.fileUrl)) {
    const kb = Math.round(OCR_SPACE_MAX_BYTES / 1024)
    console.log(`[OCR] PDF data-url ≈${storedKb} KB > ${kb} KB — OCR.space пропущен, Tesseract`)
    if (await tryTesseractPdfOcr(documentId, document.fileUrl)) return
    await applyMockOcrResult(documentId, 'Tesseract PDF не распознал большой PDF')
    return
  }

  try {
    console.log('[OCR] Starting OCR.space processing...')
    const ocrResult = await performOCRSpace(document.fileUrl)
    await persistOcrResult(documentId, ocrResult, 'OCR.space')
    return
  } catch (error) {
    const ocrErr = error instanceof Error ? error.message : String(error)
    console.error('[OCR] OCR.space failed:', ocrErr)
    if (isPDF && isOcrSpacePageLimitError(error)) {
      console.warn(`[OCR] Возможная причина: ${describeOcrSpaceLimits()}`)
    }

    if (isPDF && isOcrSpaceSizeError(error)) {
      console.log('[OCR] OCR.space size limit — fallback to Tesseract PDF')
      if (await tryTesseractPdfOcr(documentId, document.fileUrl)) return
      await applyMockOcrResult(documentId, `Tesseract PDF: ${ocrErr}`)
      return
    }

    console.error('[OCR] Trying Ollama Vision before mock:', ocrErr)
    try {
      const aiConfig = await resolveAIConfigForOCR()
      const { isOllamaVisionAvailable, callOllamaVision, fetchImageAsBase64 } = await import('@/lib/ollama')
      const visionOk = await isOllamaVisionAvailable()
      if (visionOk && document.fileType.startsWith('image/')) {
        const imageBase64 = await fetchImageAsBase64(document.fileUrl)
        const extractedText = await callOllamaVision({
          imageBase64,
          prompt:
            'Распознай весь текст на этом медицинском изображении (русский язык). Ответь только распознанным текстом.',
        })
        if (extractedText?.trim()) {
          await persistOcrResult(
            documentId,
            { text: extractedText.trim(), confidence: 0.9 },
            'Ollama Vision'
          )
          return
        }
      } else if (document.fileType.startsWith('image/') && !visionOk) {
        console.warn(
          `[OCR] Vision пропущен: нет модели ${process.env.OLLAMA_VISION_MODEL || 'llava'}. Выполните: ollama pull llava`
        )
      }
    } catch (visionError) {
      console.error('[OCR] Ollama Vision attempt failed:', visionError)
    }
      const { isOllamaVisionAvailable: checkVision } = await import('@/lib/ollama')
      const hasVisionModel = await checkVision()
      if (isPDF) {
        console.log('[OCR] PDF fallback to Tesseract after OCR.space error')
        if (await tryTesseractPdfOcr(documentId, document.fileUrl)) return
      }

      const visionHint = document.fileType.includes('pdf')
        ? `PDF: OCR.space — ${ocrErr}; Tesseract не помог`
        : `OCR.space: ${ocrErr}`
      const visionPart = document.fileType.startsWith('image/')
        ? hasVisionModel
          ? 'Ollama Vision не извлекла текст'
          : `нет модели ${process.env.OLLAMA_VISION_MODEL || 'llava'} — выполните: ollama pull llava`
        : 'для PDF Vision не используется'
      await applyMockOcrResult(documentId, `${visionHint}. ${visionPart}`)
      return
    }

    /* Для продакшена - интеграция с Google Cloud Vision:
    
    const vision = require('@google-cloud/vision')
    const client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    })
    
    const [result] = await client.textDetection(document.fileUrl)
    const text = result.fullTextAnnotation?.text || ''
    
    const { parseMedicalData } = await import('@/lib/ocr')
    const medicalData = parseMedicalData(text)
    
    documentsDb.update(documentId, {
      rawText: text,
      ocrConfidence: 0.95,
      ...medicalData,
      parsed: true
    })
    */
}

// Создать запись анализа из данных документа
async function saveAnalysisFromDocument(documentId: string) {
  try {
    console.log(`[Analysis] Attempting to save analysis for document ${documentId}`)
    const doc = await prisma.document.findUnique({ where: { id: documentId } })
    
    if (!doc) {
      console.warn(`[Analysis] Document ${documentId} not found`)
      return
    }
    
    if (!doc.parsed) {
      console.warn(`[Analysis] Document ${documentId} is not parsed yet, skipping analysis creation`)
      return
    }

    console.log(`[Analysis] Document ${documentId} is parsed, creating analysis record`)

    // Подготовка данных анализа
    const indicators = Array.isArray(doc.indicators) ? doc.indicators : []
    const hasDeviations = indicators.some((i: any) => i && i.isNormal === false)
    
    console.log(`[Analysis] Indicators count: ${indicators.length}, deviations: ${hasDeviations}`)
    
    const resultsPayload = {
      indicators,
      findings: doc.findings || null,
      rawTextLength: (doc.rawText || '').length,
    }

    const analysisData = {
      userId: doc.userId,
      documentId: doc.id,
      title: doc.studyType ? `Анализ: ${doc.studyType}` : doc.fileName,
      type: doc.studyType || 'analysis',
      date: doc.studyDate || doc.uploadDate || new Date(),
      laboratory: doc.laboratory || undefined,
      doctor: doc.doctor || undefined,
      results: JSON.stringify(resultsPayload),
      normalRange: undefined,
      status: hasDeviations ? 'abnormal' : 'normal',
      notes: doc.findings || undefined,
    }

    const existing = await prisma.analysis.findFirst({
      where: { documentId: doc.id },
      select: { id: true },
    })

    const analysis = existing
      ? await prisma.analysis.update({
          where: { id: existing.id },
          data: analysisData,
        })
      : await prisma.analysis.create({ data: analysisData })

    console.log(`[Analysis] ✅ Successfully created analysis ${analysis.id} with status: ${analysis.status}`)

    // Автоматически создаем напоминания если есть отклонения
    if (!existing && hasDeviations && indicators.length > 0) {
      try {
        await generateRemindersFromAnalysis(analysis, indicators)
        console.log(`[Analysis] ✅ Created reminders for analysis ${analysis.id}`)
      } catch (err) {
        console.warn('[Analysis] Failed to generate reminders:', err)
      }
    }
  } catch (err) {
    console.error('[Analysis] ❌ Failed to save analysis record:', err)
    console.error('[Analysis] Error details:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      console.error('[Analysis] Stack trace:', err.stack)
    }
  }
}

async function generateRemindersFromAnalysis(analysis: any, indicators: any[]) {
  const abnormalIndicators = indicators.filter(ind => ind.isNormal === false)
  
  if (abnormalIndicators.length === 0) {
    return
  }

  const analysisType = analysis.type?.toLowerCase() || ''
  const analysisTitle = analysis.title?.toLowerCase() || ''

  // 1. Напоминание о консультации врача
  const doctorReminder = {
    userId: analysis.userId,
    analysisId: analysis.id,
    title: 'Консультация врача по результатам анализов',
    description: `Рекомендуется консультация специалиста по результатам анализа "${analysis.title}". Обнаружены отклонения по показателям: ${abnormalIndicators.map(ind => ind.name).join(', ')}.`,
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // через неделю
    recurrence: 'NONE' as const,
    channels: ['EMAIL', 'PUSH']
  }
  await prisma.reminder.create({ data: doctorReminder })

  // 2. Специфичные напоминания в зависимости от типа анализа
  if (analysisType.includes('кров') || analysisTitle.includes('кров')) {
    const hasLowHemoglobin = abnormalIndicators.some(ind => 
      ind.name?.toLowerCase().includes('гемоглобин') && ind.value < (ind.referenceMin || 120)
    )
    const hasHighCholesterol = abnormalIndicators.some(ind => 
      ind.name?.toLowerCase().includes('холестерин') && ind.value > (ind.referenceMax || 5.2)
    )

    if (hasLowHemoglobin) {
      await prisma.reminder.create({
        data: {
          userId: analysis.userId,
          analysisId: analysis.id,
          title: 'Прием препаратов железа',
          description: 'Согласно результатам анализа крови, рекомендуется прием препаратов железа для повышения гемоглобина. Проконсультируйтесь с врачом о дозировке.',
          dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // через 2 дня
          recurrence: 'DAILY' as const,
          channels: ['PUSH']
        }
      })
    }

    if (hasHighCholesterol) {
      await prisma.reminder.create({
        data: {
          userId: analysis.userId,
          analysisId: analysis.id,
          title: 'Контроль питания и холестерина',
          description: 'Обнаружен повышенный уровень холестерина. Рекомендуется диета с ограничением жирной пищи и регулярный контроль показателей.',
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // через 3 дня
          recurrence: 'WEEKLY' as const,
          channels: ['EMAIL', 'PUSH']
        }
      })
    }
  }

  // 3. Напоминание о повторном анализе
  await prisma.reminder.create({
    data: {
      userId: analysis.userId,
      analysisId: analysis.id,
      title: 'Повторный анализ',
      description: `Рекомендуется повторный анализ "${analysis.title}" через 1-3 месяца для контроля динамики показателей.`,
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // через месяц
      recurrence: 'NONE' as const,
      channels: ['EMAIL', 'PUSH']
    }
  })

  console.log(`[OCR] Generated reminders for analysis ${analysis.id} with ${abnormalIndicators.length} abnormal indicators`)
}

