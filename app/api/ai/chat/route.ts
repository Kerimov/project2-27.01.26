import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

// Использует headers/cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Google Gemini AI для чата
const medicalResponses: { [key: string]: string } = {
  default: 'Я ваш персональный медицинский ассистент. Я могу помочь вам с:\n\n• Напоминаниями о приеме лекарств\n• Записью симптомов в дневник здоровья\n• Информацией о визитах к врачу\n• Общими вопросами о здоровье\n\nЧем я могу помочь?',
  
  лекарство: 'Чтобы добавить напоминание о лекарстве:\n1. Перейдите в раздел "Напоминания"\n2. Нажмите "Добавить лекарство"\n3. Укажите название, дозировку и время приема\n\nЯ буду напоминать вам о приеме!',
  
  симптом: 'Запись симптомов поможет отслеживать ваше состояние:\n1. Откройте "Дневник здоровья"\n2. Нажмите "Новая запись"\n3. Опишите симптомы, их интенсивность\n\nЕсли симптомы серьезные - обратитесь к врачу!',
  
  врач: 'Для записи к врачу:\n1. Перейдите в "Записи к врачам"\n2. Выберите специальность\n3. Укажите удобное время\n\nЯ напомню вам о приеме заранее.',
  
  давление: 'Мониторинг давления важен для здоровья:\n• Нормальное: 120/80 мм рт. ст.\n• Измеряйте в спокойном состоянии\n• Записывайте показания в дневник\n\nПри отклонениях - проконсультируйтесь с врачом.',
  
  анализ: 'Храните результаты анализов в разделе "Документы":\n1. Откройте раздел "Документы"\n2. Нажмите "Загрузить"\n3. Выберите файл или сделайте фото\n\nВсе анализы будут в одном месте!',
}

function getAIResponse(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  // Простое сопоставление ключевых слов
  for (const [key, response] of Object.entries(medicalResponses)) {
    if (key !== 'default' && lowerMessage.includes(key)) {
      return response
    }
  }
  
  // Приветствия
  if (lowerMessage.match(/привет|здравствуй|добрый день|доброе утро|добрый вечер/)) {
    return 'Здравствуйте! 👋 Я ваш персональный медицинский ассистент. Готов помочь вам заботиться о здоровье. Что вас интересует?'
  }
  
  // Помощь
  if (lowerMessage.match(/помощь|помоги|что ты умеешь|возможности/)) {
    return medicalResponses.default
  }
  
  // Благодарность
  if (lowerMessage.match(/спасибо|благодарю/)) {
    return 'Всегда рад помочь! 😊 Если возникнут еще вопросы - обращайтесь.'
  }
  
  // Вопросы о здоровье
  if (lowerMessage.match(/болит|боль|плохо|температура|кашель|насморк/)) {
    return 'Я вижу, что вас беспокоит самочувствие. Рекомендую:\n\n1. Записать симптомы в дневник здоровья\n2. Измерить температуру\n3. Если симптомы серьезные - обратиться к врачу\n\n⚠️ При острых состояниях вызывайте скорую помощь!'
  }
  
  // Профилактика
  if (lowerMessage.match(/профилактика|как быть здоровым|советы/)) {
    return 'Основы здорового образа жизни:\n\n• Регулярная физическая активность\n• Сбалансированное питание\n• Достаточный сон (7-8 часов)\n• Контроль стресса\n• Регулярные медосмотры\n• Прием витаминов (по назначению врача)\n\nЗаписывайте показатели здоровья в дневник!'
  }
  
  // Аптека
  if (lowerMessage.match(/аптека|купить|заказать/)) {
    return 'Функция заказа лекарств из аптеки будет добавлена в следующих версиях! 💊\n\nПока вы можете:\n• Вести список необходимых лекарств\n• Настроить напоминания о покупке\n• Хранить рецепты в документах'
  }
  
  // Экстренные случаи
  if (lowerMessage.match(/скорая|экстренно|срочно|умираю|сердце останов/)) {
    return '🚨 ЭКСТРЕННАЯ СИТУАЦИЯ:\n\n☎️ Вызовите скорую помощь: 103 или 112\n\nПри сердечном приступе:\n1. Вызовите скорую\n2. Примите нитроглицерин (если назначен)\n3. Сядьте или лягте\n4. Не паникуйте\n\nПомощь уже в пути!'
  }
  
  // По умолчанию
  return `Спасибо за ваш вопрос. Я стараюсь помочь с медицинскими вопросами.\n\nВы спросили: "${message}"\n\nМогу предложить:\n• Записать это в дневник здоровья\n• Настроить напоминание\n• Записаться к врачу для консультации\n\nЧто будем делать?`
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, documentIds } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Сообщение обязательно' },
        { status: 400 }
      )
    }

    // Проверка авторизации для доступа к документам
    const cookieHeader = request.headers.get('cookie')
    const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
    const token = cookies.token
    let userId: string | null = null

    if (token) {
      const payload = verifyToken(token)
      userId = payload?.userId || null
    }

    // Получаем контекст документов, если они прикреплены
    let documentsContext = ''
    if (documentIds && documentIds.length > 0 && userId) {
      console.log('[AI-CHAT] Processing with', documentIds.length, 'attached documents')
      
      for (const docId of documentIds) {
        const doc = await prisma.document.findUnique({
          where: { id: docId, userId: userId }
        })
        if (doc) {
          documentsContext += `\n\n[ДОКУМЕНТ: ${doc.fileName}]\n`
          documentsContext += `Тип исследования: ${doc.studyType || 'Не определен'}\n`
          documentsContext += `Дата: ${doc.studyDate ? new Date(doc.studyDate).toLocaleDateString('ru-RU') : 'Не указана'}\n`
          
          if (doc.indicators && Array.isArray(doc.indicators)) {
            documentsContext += '\nПоказатели:\n'
            doc.indicators.forEach((ind: any) => {
              const status = ind.isNormal ? '✅ В норме' : '❌ Отклонение'
              documentsContext += `- ${ind.name}: ${ind.value} ${ind.unit || ''} (норма: ${ind.referenceMin}-${ind.referenceMax}) ${status}\n`
            })
          }
          
          if (doc.findings) {
            documentsContext += `\nЗаключение: ${doc.findings}\n`
          }
        }
      }
    }

    // Используем Google Gemini API (если настроен)
    if (process.env.GOOGLE_API_KEY) {
      try {
        const systemPrompt = `Ты - опытный медицинский ассистент. Ты помогаешь пациентам понимать их медицинские документы и анализы.

ВАЖНО:
- Объясняй медицинские термины простым языком
- Если есть отклонения - объясни что они означают
- Не ставь диагнозы - рекомендуй консультацию врача
- Будь эмпатичным и успокаивающим
- Если прикреплены документы - используй их данные для ответа

${documentsContext ? 'ДАННЫЕ ИЗ ПРИКРЕПЛЕННЫХ ДОКУМЕНТОВ:' + documentsContext : ''}`

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${systemPrompt}\n\nВопрос пациента: ${message}`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000
            }
          })
        })

        if (response.ok) {
          const data = await response.json()
          const aiResponse = data.candidates[0].content.parts[0].text
          
          console.log('[AI-CHAT] Gemini response generated successfully')
          
          return NextResponse.json({
            response: aiResponse,
            timestamp: new Date().toISOString()
          })
        }
      } catch (geminiError) {
        console.error('[AI-CHAT] Gemini error:', geminiError)
        // Fallback to simple responses
      }
    }

    // Fallback: простые ответы если Gemini не настроен
    const response = getAIResponse(message)

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('AI Chat error:', error)
    return NextResponse.json(
      { error: 'Ошибка обработки сообщения' },
      { status: 500 }
    )
  }
}

