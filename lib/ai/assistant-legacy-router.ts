import { prisma } from '@/lib/db'
import { makeMoscowDateTime } from '@/lib/appointment-local-datetime'
import { isDiaryWriteIntent } from './assistant-diary-intent'

export type LegacyFunctionCall = {
  name: string
  parameters: Record<string, unknown>
}

export type LegacyFunctionResult = {
  message: string
  data: unknown
}

function getAppointmentTypeLabel(type: string): string {
  switch (type) {
    case 'consultation': return 'Консультация'
    case 'follow_up': return 'Повторный прием'
    case 'routine': return 'Плановый осмотр'
    case 'emergency': return 'Срочный прием'
    default: return type
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled': return 'Запланировано'
    case 'confirmed': return 'Подтверждено'
    case 'completed': return 'Завершено'
    case 'cancelled': return 'Отменено'
    case 'rescheduled': return 'Перенесено'
    default: return status
  }
}

export async function analyzeMessageAndDetermineFunction(message: string, userId: string) {
  const lowerMessage = message.toLowerCase()

  if (isDiaryWriteIntent(message)) {
    return null
  }
  
  // Запись на прием - сначала показываем список врачей
  if (lowerMessage.match(/записать|записаться|запись.*прием|прием.*врач|когда.*врач/) &&
      !lowerMessage.match(/дневник/) && 
      !lowerMessage.match(/\d{1,2}:\d{2}/) && // Нет времени
      !lowerMessage.match(/\d{1,2}[.\-/]\d{1,2}/)) { // Нет даты
    // Если нет конкретной даты/времени, показываем список врачей
    return {
      name: 'get_doctors',
      parameters: await extractDoctorParameters(message)
    }
  }
  
  // Запись на прием с конкретными параметрами
  if (lowerMessage.match(/записать|записаться|запись.*прием/) && 
      (lowerMessage.match(/\d{1,2}:\d{2}/) || lowerMessage.match(/\d{1,2}[.\-/]\d{1,2}/))) {
    return {
      name: 'book_appointment',
      parameters: await extractAppointmentParameters(message, userId)
    }
  }
  
  // Результаты анализов
  if (lowerMessage.match(/анализ|результат|показатель|лабораторн|кровь|моча|биохимия/)) {
    return {
      name: 'get_analysis_results',
      parameters: await extractAnalysisParameters(message)
    }
  }
  
  // Рекомендации
  if (lowerMessage.match(/рекомендац|совет|что.*делать|как.*лечить|диета|упражнен/)) {
    return {
      name: 'get_recommendations',
      parameters: await extractRecommendationParameters(message)
    }
  }
  
  // Список врачей
  if (lowerMessage.match(/врач|доктор|специалист|кто.*лечит|какой.*врач/)) {
    return {
      name: 'get_doctors',
      parameters: await extractDoctorParameters(message)
    }
  }
  
  // Записи на приемы
  if (lowerMessage.match(/мои.*записи|прием|расписание|когда.*прием/)) {
    return {
      name: 'get_appointments',
      parameters: await extractAppointmentQueryParameters(message)
    }
  }
  
  return null
}

// Извлечение параметров для записи на прием
async function extractAppointmentParameters(message: string, userId: string) {
  const params: any = {}
  
  // Попытка извлечь дату
  const dateMatch = message.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?|(завтра|послезавтра|сегодня)/)
  if (dateMatch) {
    if (dateMatch[4]) {
      // Относительная дата (завтра, послезавтра, сегодня)
      const today = new Date()
      if (dateMatch[4] === 'завтра') {
        today.setDate(today.getDate() + 1)
      } else if (dateMatch[4] === 'послезавтра') {
        today.setDate(today.getDate() + 2)
      }
      params.date = today.toISOString().split('T')[0]
    } else if (dateMatch[1] && dateMatch[2]) {
      // Конкретная дата (дд.мм или дд.мм.гггг)
      const day = dateMatch[1].padStart(2, '0')
      const month = dateMatch[2].padStart(2, '0')
      const year = dateMatch[3] || new Date().getFullYear().toString()
      params.date = `${year.length === 2 ? '20' + year : year}-${month}-${day}`
    }
  } else {
    params.date = new Date().toISOString().split('T')[0]
  }
  
  // Попытка извлечь время
  const timeMatch = message.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    params.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
  } else {
    params.time = '10:00' // По умолчанию
  }
  
  // Тип приема
  if (message.match(/консультац/i)) {
    params.appointmentType = 'consultation'
  } else if (message.match(/повторн|контрольн/i)) {
    params.appointmentType = 'follow_up'
  } else if (message.match(/планов|профилактич/i)) {
    params.appointmentType = 'routine'
  } else if (message.match(/срочн|экстрен/i)) {
    params.appointmentType = 'emergency'
  } else {
    params.appointmentType = 'consultation'
  }
  
  // Попытка извлечь ФИО врача из сообщения
  try {
    // Ищем паттерны типа "к [ФИО]" или "врачу [ФИО]"
    const doctorNameMatch = message.match(/(?:к|врачу)\s+([А-ЯЁа-яё]+(?:\s+[А-ЯЁа-яё]+){1,3})/i)
    
    if (doctorNameMatch) {
      const doctorName = doctorNameMatch[1].trim()
      console.log('[AI-ASSISTANT] Searching for doctor by name:', doctorName)
      
      // Ищем врача по имени (частичное совпадение)
      const doctors = await prisma.doctorProfile.findMany({
        include: { user: true },
        take: 10
      })
      
      const foundDoctor = doctors.find(d => 
        d.user.name.toLowerCase().includes(doctorName.toLowerCase()) ||
        doctorName.toLowerCase().includes(d.user.name.toLowerCase())
      )
      
      if (foundDoctor) {
        params.doctorId = foundDoctor.id
        console.log('[AI-ASSISTANT] Doctor found by name:', foundDoctor.user.name)
      } else {
        console.log('[AI-ASSISTANT] Doctor not found by name, using first available')
        // Если не нашли по имени, берем первого доступного
        if (doctors.length > 0) {
          params.doctorId = doctors[0].id
        }
      }
    } else {
      // Если ФИО не указано, берем первого доступного врача
      const doctors = await prisma.doctorProfile.findMany({
        include: { user: true },
        take: 1
      })
      
      if (doctors.length > 0) {
        params.doctorId = doctors[0].id
      }
    }
  } catch (dbError) {
    console.error('[AI-ASSISTANT] Database error in extractAppointmentParameters:', dbError)
    // Продолжаем без doctorId, функция bookAppointment обработает это
  }
  
  return params
}

// Извлечение параметров для анализов
async function extractAnalysisParameters(message: string) {
  const params: any = {}
  
  if (message.match(/кровь|общий.*анализ/i)) {
    params.category = 'blood'
  } else if (message.match(/моча/i)) {
    params.category = 'urine'
  } else if (message.match(/биохимия/i)) {
    params.category = 'biochemistry'
  }
  
  const limitMatch = message.match(/последн(ие|их)?\s*(\d+)/)
  if (limitMatch) {
    params.limit = parseInt(limitMatch[2])
  } else {
    params.limit = 5
  }
  
  return params
}

// Извлечение параметров для рекомендаций
async function extractRecommendationParameters(message: string) {
  const params: any = {}
  
  if (message.match(/питан|диет/i)) {
    params.category = 'nutrition'
  } else if (message.match(/физическ|спорт|упражнен/i)) {
    params.category = 'exercise'
  } else if (message.match(/лекарств|препарат/i)) {
    params.category = 'medication'
  }
  
  const limitMatch = message.match(/(\d+).*рекомендац/)
  if (limitMatch) {
    params.limit = parseInt(limitMatch[1])
  } else {
    params.limit = 3
  }
  
  return params
}

// Извлечение параметров для врачей
async function extractDoctorParameters(message: string) {
  const params: any = {}
  
  if (message.match(/терапевт|семейн/i)) {
    params.specialization = 'Терапевт'
  } else if (message.match(/кардиолог|сердц/i)) {
    params.specialization = 'Кардиолог'
  } else if (message.match(/невролог|головн/i)) {
    params.specialization = 'Невролог'
  } else if (message.match(/эндокринолог|диабет/i)) {
    params.specialization = 'Эндокринолог'
  }
  
  if (message.match(/доступн|свободн/i)) {
    params.available = true
  }
  
  return params
}

// Извлечение параметров для запросов записей
async function extractAppointmentQueryParameters(message: string) {
  const params: any = {}
  
  if (message.match(/предстоящ|ближайш|будущ/i)) {
    params.upcoming = true
  } else if (message.match(/отменен/i)) {
    params.status = 'cancelled'
  } else if (message.match(/завершен|прошедш/i)) {
    params.status = 'completed'
  }
  
  return params
}

// Выполнение функций
export async function executeLegacyFunction(functionCall: LegacyFunctionCall, userId: string) {
  try {
    switch (functionCall.name) {
      case 'book_appointment':
        return await bookAppointment(functionCall.parameters, userId)
      
      case 'get_analysis_results':
        return await getAnalysisResults(functionCall.parameters, userId)
      
      case 'get_recommendations':
        return await getRecommendations(functionCall.parameters, userId)
      
      case 'get_doctors':
        return await getDoctors(functionCall.parameters)
      
      case 'get_appointments':
        return await getAppointments(functionCall.parameters, userId)
      
      default:
        return {
          message: 'Извините, я не понимаю, что вы хотите сделать.',
          data: null
        }
    }
  } catch (error) {
    console.error(`Error executing function ${functionCall.name}:`, error)
    return {
      message: 'Произошла ошибка при выполнении запроса. Попробуйте еще раз.',
      data: null
    }
  }
}

// Функция записи на прием
async function bookAppointment(params: any, userId: string) {
  try {
    console.log('[AI-ASSISTANT] bookAppointment called with params:', params)
    console.log('[AI-ASSISTANT] Prisma availability check:', { 
      hasPrisma: !!prisma,
      hasDoctorProfileModel: !!prisma?.doctorProfile,
      doctorProfileModelType: typeof prisma?.doctorProfile
    })
    
    if (!prisma || !prisma.doctorProfile) {
      throw new Error('Prisma client not initialized properly')
    }
    
    const { doctorId, appointmentType, date, time, notes } = params
    
    // Проверяем, что врач существует
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: true }
    })
    console.log('[AI-ASSISTANT] Doctor found:', !!doctor)
    
    if (!doctorId) {
      return {
        message: '⚠️ В системе пока нет зарегистрированных врачей.\n\n💡 Чтобы записаться на прием:\n1. Администратор должен создать учетную запись врача через Prisma Studio (http://localhost:5555)\n2. Или позвоните в регистратуру для записи\n\n📞 Телефон регистратуры: +7 (999) 123-45-67\n\n🔧 Для администратора:\n• Откройте http://localhost:5555\n• Создайте пользователя с ролью DOCTOR\n• Создайте запись в таблице DoctorProfile с userId этого пользователя',
        data: null
      }
    }

    if (!doctor) {
      return {
        message: '⚠️ Указанный врач не найден в системе.\n\nПопробуйте:\n• "Покажи список врачей"\n• "Найди терапевта"\n• Или позвоните в регистратуру для записи',
        data: null
      }
    }
    
    // Получаем информацию о пациенте
    const patient = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!patient) {
      return {
        message: '⚠️ Не удалось найти информацию о пациенте.',
        data: null
      }
    }
    
    const scheduledAt = makeMoscowDateTime(date, time)
    
    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId: userId,
        patientName: patient.name,
        patientEmail: patient.email,
        appointmentType,
        scheduledAt,
        duration: 30,
        status: 'scheduled',
        notes
      },
      include: {
        doctor: {
          include: { user: true }
        }
      }
    })
    
    return {
      message: `✅ Запись на прием успешно создана!\n\n📅 Дата: ${scheduledAt.toLocaleDateString('ru-RU')}\n🕐 Время: ${scheduledAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n👨‍⚕️ Врач: ${doctor.user.name}\n📋 Тип: ${getAppointmentTypeLabel(appointmentType)}`,
      data: appointment
    }
  } catch (error) {
    console.error('[AI-ASSISTANT] Error in bookAppointment:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('Unique constraint')) {
      return {
        message: '⚠️ Выбранное время уже занято.\n\nПопробуйте:\n• Выбрать другое время\n• "Покажи свободные слоты на завтра"\n• Позвонить в регистратуру для уточнения расписания',
        data: null
      }
    }
    
    return {
      message: `⚠️ Не удалось создать запись на прием.\n\n🔍 Причина: ${errorMessage}\n\n💡 Попробуйте:\n• Указать конкретную дату и время\n• Проверить, что врач доступен\n• Позвонить в регистратуру`,
      data: null
    }
  }
}

// Функция получения результатов анализов
async function getAnalysisResults(params: any, userId: string) {
  try {
    const { category, limit = 5 } = params
    
    let whereClause: any = { userId }
    
    if (category) {
      whereClause.category = category
    }
    
    const analyses = await prisma.analysis.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    
    if (analyses.length === 0) {
      return {
        message: 'У вас пока нет результатов анализов. Загрузите их в разделе "Документы".',
        data: null
      }
    }
    
    let message = `📊 Ваши результаты анализов:\n\n`
    
    analyses.forEach((analysis, index) => {
      message += `${index + 1}. ${analysis.title || 'Анализ'}\n`
      message += `   📅 Дата: ${new Date(analysis.createdAt).toLocaleDateString('ru-RU')}\n`
      
      if (analysis.results) {
        try {
          const results = JSON.parse(analysis.results)
          if (results.indicators && results.indicators.length > 0) {
            message += `   📈 Показатели:\n`
            results.indicators.slice(0, 3).forEach((indicator: any) => {
              const status = indicator.isNormal ? '✅' : '❌'
              message += `      • ${indicator.name}: ${indicator.value} ${indicator.unit || ''} ${status}\n`
            })
            if (results.indicators.length > 3) {
              message += `      • ... и еще ${results.indicators.length - 3} показателей\n`
            }
          }
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
      message += `\n`
    })
    
    return {
      message,
      data: analyses
    }
  } catch (error) {
    return {
      message: 'Не удалось получить результаты анализов.',
      data: null
    }
  }
}

// Функция получения рекомендаций
async function getRecommendations(params: any, userId: string) {
  try {
    const { category, limit = 3 } = params
    
    let whereClause: any = { status: 'ACTIVE' }
    
    if (category) {
      whereClause.category = category
    }
    
    const recommendations = await prisma.recommendation.findMany({
      where: whereClause,
      orderBy: { priority: 'desc' },
      take: limit
    })
    
    if (recommendations.length === 0) {
      return {
        message: 'Сейчас нет персональных рекомендаций. Проверьте раздел "Рекомендации" для общих советов по здоровью.',
        data: null
      }
    }
    
    let message = `💡 Персональные рекомендации:\n\n`
    
    recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec.title}\n`
      message += `   📝 ${rec.description}\n`
      if (rec.type) {
        message += `   🏷️ Тип: ${rec.type}\n`
      }
      message += `\n`
    })
    
    return {
      message,
      data: recommendations
    }
  } catch (error) {
    return {
      message: 'Не удалось получить рекомендации.',
      data: null
    }
  }
}

// Функция получения списка врачей
async function getDoctors(params: any) {
  try {
    const { specialization, available } = params
    
    let whereClause: any = {}
    
    if (specialization) {
      // SQLite не поддерживает mode: 'insensitive', используем обычный contains
      whereClause.specialization = {
        contains: specialization
      }
    }
    
    const doctors = await prisma.doctorProfile.findMany({
      where: whereClause,
      include: { user: true },
      take: 10
    })
    
    if (doctors.length === 0) {
      return {
        message: 'Врачи не найдены. Попробуйте изменить критерии поиска.',
        data: null
      }
    }
    
    let message = `👨‍⚕️ Доступные врачи:\n\n`
    
    doctors.forEach((doctor, index) => {
      message += `${index + 1}. **${doctor.user.name}**\n`
      message += `   🏥 Специализация: ${doctor.specialization}\n`
      if (doctor.phone) {
        message += `   📞 Телефон: ${doctor.phone}\n`
      }
      message += `\n`
    })
    
    message += `\n📅 Для записи на прием напишите:\n`
    message += `"Запиши меня к [ФИО врача] на [дата] в [время]"\n\n`
    message += `Например:\n`
    message += `• "Запиши меня к ${doctors[0].user.name} на завтра в 14:00"\n`
    message += `• "Запиши меня к ${doctors[0].user.name} на 10.10 в 10:00"\n`
    message += `• "Запиши меня к ${doctors[0].user.name} на послезавтра в 15:30"`
    
    return {
      message,
      data: doctors
    }
  } catch (error) {
    return {
      message: 'Не удалось получить список врачей.',
      data: null
    }
  }
}

// Функция получения записей на приемы
async function getAppointments(params: any, userId: string) {
  try {
    const { status, upcoming } = params
    
    let whereClause: any = { patientId: userId }
    
    if (status) {
      whereClause.status = status
    }
    
    if (upcoming) {
      whereClause.scheduledAt = {
        gte: new Date()
      }
    }
    
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        doctor: {
          include: { user: true }
        }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10
    })
    
    if (appointments.length === 0) {
      return {
        message: upcoming ? 'У вас нет предстоящих записей на приемы.' : 'У вас нет записей на приемы.',
        data: null
      }
    }
    
    let message = `📅 Ваши записи на приемы:\n\n`
    
    appointments.forEach((appointment, index) => {
      message += `${index + 1}. ${appointment.doctor.user.name}\n`
      message += `   📅 Дата: ${new Date(appointment.scheduledAt).toLocaleDateString('ru-RU')}\n`
      message += `   🕐 Время: ${new Date(appointment.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`
      message += `   📋 Тип: ${getAppointmentTypeLabel(appointment.appointmentType)}\n`
      message += `   📊 Статус: ${getStatusLabel(appointment.status)}\n`
      if (appointment.notes) {
        message += `   📝 Заметки: ${appointment.notes}\n`
      }
      message += `\n`
    })
    
    return {
      message,
      data: appointments
    }
  } catch (error) {
    return {
      message: 'Не удалось получить записи на приемы.',
      data: null
    }
  }
}

export async function tryLegacyAssistantRouter(
  message: string,
  userId: string
): Promise<{ functionName: string; message: string; data: unknown } | null> {
  const call = await analyzeMessageAndDetermineFunction(message, userId)
  if (!call) return null
  const result = await executeLegacyFunction(call, userId)
  return {
    functionName: call.name,
    message: result.message,
    data: result.data,
  }
}
