import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
// Использует headers, помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

// POST /api/analyses/[id]/reminders - создать напоминания на основе анализа
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    console.log('Authorization header:', authHeader)
    
    const token = authHeader?.replace('Bearer ', '')
    console.log('Extracted token:', token ? 'present' : 'missing')
    
    if (!token) {
      console.log('No token provided')
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    console.log('Token verification result:', decoded ? 'valid' : 'invalid')
    
    if (!decoded) {
      console.log('Invalid token provided')
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const analysisId = params.id
    console.log('Looking for analysis:', analysisId, 'for user:', decoded.userId)
    
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId, userId: decoded.userId },
    })

    if (!analysis) {
      console.log('Analysis not found:', analysisId)
      return NextResponse.json({ error: 'Анализ не найден' }, { status: 404 })
    }
    
    console.log('Analysis found:', analysis.id, analysis.title)

    // Парсим результаты анализа
    let indicators: any[] = []
    try {
      if (!analysis.results) {
        console.log('Analysis has no results')
        return NextResponse.json({ error: 'Анализ не содержит результатов' }, { status: 400 })
      }
      
      let results = analysis.results
      if (typeof results === 'string') {
        results = JSON.parse(results)
      }
      
      console.log('Analysis results:', JSON.stringify(results, null, 2))

      // Проверяем различные структуры данных
      if (results && typeof results === 'object') {
        if (Array.isArray((results as any).indicators)) {
          indicators = (results as any).indicators
        } else if (Array.isArray(results)) {
          indicators = results
        } else if ((results as any).indicators && typeof (results as any).indicators === 'object') {
          // Если indicators это объект, преобразуем в массив
          indicators = Object.values((results as any).indicators)
        }
      }

      console.log('Extracted indicators:', JSON.stringify(indicators, null, 2))
    } catch (error) {
      console.log('Error parsing analysis results:', error)
      return NextResponse.json({ error: 'Ошибка парсинга результатов анализа' }, { status: 400 })
    }

    // Генерируем напоминания на основе отклонений
    const reminders = generateRemindersFromAnalysis(analysis, indicators)
    
    // Создаем напоминания в базе данных
    const createdReminders = []
    try {
      for (const reminderData of reminders) {
        console.log('Creating reminder:', JSON.stringify(reminderData, null, 2))
        const reminder = await prisma.reminder.create({
          data: {
            userId: decoded.userId,
            analysisId: analysisId,
            title: reminderData.title,
            description: reminderData.description,
            dueAt: reminderData.dueAt,
            recurrence: reminderData.recurrence,
            channels: reminderData.channels
          }
        })
        createdReminders.push(reminder)
        console.log('Reminder created successfully:', reminder.id)
      }
    } catch (dbError) {
      console.log('Database error creating reminders:', dbError)
      return NextResponse.json({ error: 'Ошибка создания напоминаний в базе данных' }, { status: 500 })
    }

    console.log(`Created ${createdReminders.length} reminders for analysis ${analysisId}`)
    return NextResponse.json({ 
      message: `Создано ${createdReminders.length} напоминаний`,
      reminders: createdReminders 
    })

  } catch (error) {
    console.log('Error creating reminders from analysis:', error)
    return NextResponse.json({ error: 'Ошибка создания напоминаний' }, { status: 500 })
  }
}

function generateRemindersFromAnalysis(analysis: any, indicators: any[]): any[] {
  const reminders: any[] = []
  
  // Убеждаемся, что indicators это массив
  if (!Array.isArray(indicators)) {
    console.log('Indicators is not an array:', indicators)
    return reminders
  }

  const abnormalIndicators = indicators.filter(ind => ind && ind.isNormal === false)

  console.log(`Found ${abnormalIndicators.length} abnormal indicators out of ${indicators.length} total`)
  
  if (abnormalIndicators.length === 0) {
    return reminders
  }

  // Определяем тип анализа для более точных рекомендаций
  const analysisType = analysis.type?.toLowerCase() || ''
  const analysisTitle = analysis.title?.toLowerCase() || ''

  // 1. Напоминание о консультации врача
  const doctorReminder = {
    title: 'Консультация врача по результатам анализов',
    description: `Рекомендуется консультация специалиста по результатам анализа "${analysis.title}". Обнаружены отклонения по показателям: ${abnormalIndicators.map(ind => ind.name).join(', ')}.`,
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // через неделю
    recurrence: 'NONE' as const,
    channels: ['EMAIL', 'PUSH']
  }
  reminders.push(doctorReminder)

  // 2. Специфичные напоминания в зависимости от типа анализа
  if (analysisType.includes('кров') || analysisTitle.includes('кров')) {
    // Анализ крови
    const hasLowHemoglobin = abnormalIndicators.some(ind => 
      ind.name?.toLowerCase().includes('гемоглобин') && ind.value < (ind.referenceMin || 120)
    )
    const hasHighCholesterol = abnormalIndicators.some(ind => 
      ind.name?.toLowerCase().includes('холестерин') && ind.value > (ind.referenceMax || 5.2)
    )

    if (hasLowHemoglobin) {
      reminders.push({
        title: 'Прием препаратов железа',
        description: 'Согласно результатам анализа крови, рекомендуется прием препаратов железа для повышения гемоглобина. Проконсультируйтесь с врачом о дозировке.',
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // через 2 дня
        recurrence: 'DAILY' as const,
        channels: ['PUSH']
      })
    }

    if (hasHighCholesterol) {
      reminders.push({
        title: 'Контроль питания и холестерина',
        description: 'Обнаружен повышенный уровень холестерина. Рекомендуется диета с ограничением жирной пищи и регулярный контроль показателей.',
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // через 3 дня
        recurrence: 'WEEKLY' as const,
        channels: ['EMAIL', 'PUSH']
      })
    }
  }

  if (analysisType.includes('моч') || analysisTitle.includes('моч')) {
    // Анализ мочи
    const hasProtein = abnormalIndicators.some(ind => 
      ind.name?.toLowerCase().includes('белок')
    )
    const hasGlucose = abnormalIndicators.some(ind => 
      ind.name?.toLowerCase().includes('глюкоз')
    )

    if (hasProtein) {
      reminders.push({
        title: 'Контроль функции почек',
        description: 'Обнаружен белок в моче. Рекомендуется консультация нефролога и контроль функции почек.',
        dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // через 5 дней
        recurrence: 'NONE' as const,
        channels: ['EMAIL', 'SMS']
      })
    }

    if (hasGlucose) {
      reminders.push({
        title: 'Контроль уровня сахара',
        description: 'Обнаружена глюкоза в моче. Рекомендуется консультация эндокринолога и контроль уровня сахара в крови.',
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // через 3 дня
        recurrence: 'NONE' as const,
        channels: ['EMAIL', 'PUSH']
      })
    }
  }

  // 3. Напоминание о повторном анализе
  const repeatAnalysisReminder = {
    title: 'Повторный анализ',
    description: `Рекомендуется повторный анализ "${analysis.title}" через 1-3 месяца для контроля динамики показателей.`,
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // через месяц
    recurrence: 'NONE' as const,
    channels: ['EMAIL', 'PUSH']
  }
  reminders.push(repeatAnalysisReminder)

  // 4. Общие рекомендации по образу жизни
  if (abnormalIndicators.length > 2) {
    reminders.push({
      title: 'Общие рекомендации по здоровью',
      description: 'Обнаружено несколько отклонений в анализах. Рекомендуется пересмотр образа жизни: правильное питание, регулярные физические нагрузки, отказ от вредных привычек.',
      dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // завтра
      recurrence: 'WEEKLY' as const,
      channels: ['EMAIL']
    })
  }

  return reminders
}
