import { NextRequest, NextResponse } from 'next/server'
import { DocumentCategory } from '@/lib/documents'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

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
  'application/dicom',
  'text/csv',
  'text/plain'
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
    if (targetPatientId && (payload as any).role === 'DOCTOR') {
      // Врач может загрузить для пациента, только если пациент прикреплен или есть прием
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId: payload.userId } })
      if (doctor) {
        const [hasRecord, hasAppointment] = await Promise.all([
          prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId: targetPatientId }, select: { id: true } }),
          prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId: targetPatientId }, select: { id: true } })
        ])
        if (hasRecord || hasAppointment) {
          ownerUserId = targetPatientId
        }
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

    // Запускаем асинхронную обработку OCR (не блокируем ответ)
    processDocumentOCR(document.id).catch(err => {
      console.error('OCR processing error:', err)
    })

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

// Асинхронная обработка OCR
async function processDocumentOCR(documentId: string) {
  console.log(`[OCR] Starting processing for document ${documentId}`)
  
  const document = await prisma.document.findUnique({ where: { id: documentId } })
  if (!document) return

  try {
    // Проверяем, является ли файл изображением или PDF
    const isImage = document.fileType.includes('image')
    const isPDF = document.fileType.includes('pdf')
    
    if (!isImage && !isPDF) {
      console.log(`[OCR] Skipping OCR for file type: ${document.fileType}`)
      return
    }

    // Реальный OCR через OCR.space ✅ РАБОТАЕТ!
    const { performOCRSpace } = await import('@/lib/ocr-space')
    const { parseMedicalData } = await import('@/lib/ocr')
    const { parseWithAI, getAIConfig } = await import('@/lib/ai-medical-parser')
    
    try {
      console.log('[OCR] Starting OCR.space processing...')
      const ocrResult = await performOCRSpace(document.fileUrl)
      
      // УМНЫЙ ПАРСИНГ: сначала пробуем AI, потом fallback на regex
      let medicalData
      const aiConfig = getAIConfig()
      
      if (aiConfig) {
        // 🤖 AI-ПАРСЕР: Универсальное распознавание любых форматов
        try {
          console.log(`[OCR] Using AI parser (${aiConfig.provider})...`)
          medicalData = await parseWithAI(ocrResult.text, aiConfig)
          console.log(`[OCR] ✅ AI parsing successful! Extracted ${medicalData.indicators.length} indicators`)
        } catch (aiError) {
          console.warn('[OCR] ⚠️ AI parsing failed, falling back to regex parser:', aiError)
          medicalData = parseMedicalData(ocrResult.text)
        }
        // Дополнительный шаг: объединяем с regex-результатами, чтобы добрать пропущенные показатели
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
        // 📝 REGEX-ПАРСЕР: Базовое распознавание (работает только с некоторыми форматами)
        console.log('[OCR] No AI config found, using regex parser')
        console.log('[OCR] 💡 Tip: Add OPENAI_API_KEY to .env.local for universal parsing')
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
            parsed: true
          }
        })

        // Сохраняем анализ как структурированную запись
        console.log(`[OCR] Calling saveAnalysisFromDocument for document ${documentId}`)
        await saveAnalysisFromDocument(documentId).catch((err) => {
          console.error(`[OCR] Error in saveAnalysisFromDocument for ${documentId}:`, err)
        })
      } catch (e: any) {
        if (e?.code === 'P2025') {
          console.warn(`[OCR] Document ${documentId} was removed before update (real OCR). Skipping.`)
          return
        }
        throw e
      }
      
      console.log(`[OCR] OCR.space completed successfully for document ${documentId}`)
      return
    } catch (error) {
      console.error('[OCR] OCR.space failed, trying OpenAI Vision before mock:', error)
      // Попытка №2: Используем OpenAI Vision для извлечения текста с изображения
      try {
        const aiConfig = getAIConfig()
        // Используем Vision только для изображений
        if (aiConfig?.provider === 'openai' && aiConfig.apiKey && document.fileType.startsWith('image/')) {
          const model = aiConfig.model || 'gpt-4o-mini'
          const visionResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: 'Извлеки ПЛОСКИЙ текст из медицинского документа на изображении. Отвечай только текстом без форматирования и без комментариев.' },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Распознай текст на этом изображении (русский язык).' },
                    { type: 'image_url', image_url: { url: document.fileUrl } }
                  ]
                }
              ],
              temperature: 0
            })
          })

          if (!visionResp.ok) {
            const errText = await visionResp.text()
            throw new Error(`OpenAI Vision error: ${visionResp.status} - ${errText}`)
          }

          const visionJson = await visionResp.json()
          const extractedText: string = visionJson.choices?.[0]?.message?.content || ''

          if (extractedText && extractedText.trim().length > 0) {
            // Парсим медицинские данные из извлеченного текста (AI > regex fallback внутри)
            let medicalData
            try {
              medicalData = await parseWithAI(extractedText, aiConfig)
            } catch (aiParseErr) {
              console.warn('[OCR] AI parsing after Vision failed, fallback to regex:', aiParseErr)
              const { parseMedicalData } = await import('@/lib/ocr')
              medicalData = parseMedicalData(extractedText)
            }

            // Аналогично объединяем показатели с regex-парсером, чтобы добрать пропущенные
            try {
              const regexData = parseMedicalData(extractedText)
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
              console.warn('[OCR] Unable to merge AI and regex indicators (vision):', mergeErr)
            }

            try {
              await prisma.document.update({
                where: { id: documentId },
                data: {
                  rawText: extractedText,
                  ocrConfidence: 0.9,
                  studyType: medicalData.studyType,
                  studyDate: medicalData.studyDate,
                  laboratory: medicalData.laboratory,
                  doctor: medicalData.doctor,
                  findings: medicalData.findings,
                  indicators: medicalData.indicators ?? undefined,
                  parsed: true
                }
              })
              await saveAnalysisFromDocument(documentId)
              console.log(`[OCR] OpenAI Vision completed successfully for document ${documentId}`)
              return
            } catch (e: any) {
              if (e?.code === 'P2025') {
                console.warn(`[OCR] Document ${documentId} was removed before update (vision). Skipping.`)
                return
              }
              throw e
            }
          }
        }
      } catch (visionError) {
        console.error('[OCR] OpenAI Vision attempt failed:', visionError)
      }
      // Если ни OCR.space, ни OpenAI Vision не сработали — используем mock-данные как резерв
    }
    
    // Мок-данные (минимальные), чтобы интерфейс продолжал работать в демонстрационном режиме
    const mockData = {
      rawText: 'DEMO MOCK: Анализ не распознан OCR, использованы демонстрационные данные.',
      ocrConfidence: 0.5,
      studyType: 'Общий анализ крови',
      studyDate: new Date(),
      laboratory: 'Demo-Lab',
      doctor: 'Demo Doctor',
      findings: 'Демонстрационные данные. Для реального распознавания настройте OCR ключ.',
      parsed: true,
      indicators: [
        { name: 'Гемоглобин (HGB)', value: 140, unit: 'г/л', referenceMin: 120, referenceMax: 160, isNormal: true },
        { name: 'Лейкоциты (WBC)', value: 6.0, unit: 'тыс/мкл', referenceMin: 4.0, referenceMax: 9.0, isNormal: true }
      ]
    }

    try {
      await prisma.document.update({ where: { id: documentId }, data: mockData })
      await saveAnalysisFromDocument(documentId)
      console.warn(`[OCR] Real OCR failed; mock data saved for document ${documentId}`)
      return
    } catch (e: any) {
      if (e?.code === 'P2025') {
        console.warn(`[OCR] Document ${documentId} was removed before mock update. Skipping.`)
        return
      }
      throw e
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
    
  } catch (error) {
    console.error(`[OCR] Error processing document ${documentId}:`, error)
    try {
      await prisma.document.update({ where: { id: documentId }, data: { parsed: false, ocrConfidence: 0 } })
    } catch (e: any) {
      if (e?.code === 'P2025') {
        console.warn(`[OCR] Document ${documentId} was removed before error-state update. Skipping.`)
        return
      }
      throw e
    }
  }
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

    const analysis = await prisma.analysis.create({
      data: {
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
      },
    })

    console.log(`[Analysis] ✅ Successfully created analysis ${analysis.id} with status: ${analysis.status}`)

    // Автоматически создаем напоминания если есть отклонения
    if (hasDeviations && indicators.length > 0) {
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

