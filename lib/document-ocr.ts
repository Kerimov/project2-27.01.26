import { prisma } from '@/lib/db'

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
    await saveAnalysisFromDocument(documentId)
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
    await saveAnalysisFromDocument(documentId)
    console.warn(`[OCR] Mock/fallback saved for document ${documentId}`)
  } catch (e: any) {
    if (e?.code === 'P2025') return
    throw e
  }
}

export async function processDocumentOCR(documentId: string) {
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
  if (document.parsed) {
    await saveAnalysisFromDocument(documentId)
    return
  }

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
    await saveAnalysisFromDocument(documentId)
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
  }
}

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

    const indicators = Array.isArray(doc.indicators) ? doc.indicators : []
    const hasDeviations = indicators.some((i: any) => i && i.isNormal === false)
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

    console.log(`[Analysis] ✅ Saved analysis ${analysis.id} with status: ${analysis.status}`)

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

  const doctorReminder = {
    userId: analysis.userId,
    analysisId: analysis.id,
    title: 'Консультация врача по результатам анализов',
    description: `Рекомендуется консультация специалиста по результатам анализа "${analysis.title}". Обнаружены отклонения по показателям: ${abnormalIndicators.map(ind => ind.name).join(', ')}.`,
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    recurrence: 'NONE' as const,
    channels: ['EMAIL', 'PUSH']
  }
  await prisma.reminder.create({ data: doctorReminder })

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
          dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
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
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          recurrence: 'WEEKLY' as const,
          channels: ['EMAIL', 'PUSH']
        }
      })
    }
  }

  await prisma.reminder.create({
    data: {
      userId: analysis.userId,
      analysisId: analysis.id,
      title: 'Повторный анализ',
      description: `Рекомендуется повторный анализ "${analysis.title}" через 1-3 месяца для контроля динамики показателей.`,
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      recurrence: 'NONE' as const,
      channels: ['EMAIL', 'PUSH']
    }
  })

  console.log(`[OCR] Generated reminders for analysis ${analysis.id} with ${abnormalIndicators.length} abnormal indicators`)
}
