/**
 * AI-POWERED МЕДИЦИНСКИЙ ПАРСЕР
 * 
 * Универсальное решение для распознавания ЛЮБЫХ медицинских анализов
 * с использованием Large Language Models (Ollama, Claude и др.)
 * 
 * Преимущества:
 * - Работает с любыми форматами лабораторий
 * - Не требует ручной настройки под каждую клинику
 * - Понимает контекст и медицинскую терминологию
 * - Автоматически определяет референсные значения
 */

import { ParsedMedicalData } from './ocr'
import { logger } from './logger'
import { callOllamaChat, getOllamaModel } from './ollama'

interface AIParserConfig {
  provider: 'ollama' | 'anthropic' | 'local'
  apiKey?: string
  model?: string
}

/**
 * Промпт для AI-модели
 * Детальная инструкция для извлечения медицинских данных
 */
const MEDICAL_EXTRACTION_PROMPT = `Ты - эксперт по анализу медицинских документов. Твоя задача - извлечь структурированные данные из текста медицинского анализа.

ВАЖНО: Анализируй РЕАЛЬНЫЕ данные из документа, не придумывай значения!

Извлеки следующую информацию:

1. **Тип исследования** - название анализа (например: "Общий анализ крови", "Биохимический анализ", "Анализ мочи")

2. **Дата исследования** - дата взятия биоматериала или регистрации (формат: YYYY-MM-DD)

3. **Лаборатория** - название медучреждения или лаборатории

4. **Врач** - ФИО врача (если указано)

5. **Показатели** - МАКСИМАЛЬНОЕ количество медицинских показателей из документа:
   Для КАЖДОГО показателя извлеки:
   - name: полное название показателя с аббревиатурой (например: "Гемоглобин (Hb)")
   - value: числовое значение (только число, без единиц)
   - unit: единицы измерения (г/л, %, тыс/мкл и т.д.)
   - referenceMin: минимальное референсное значение (если указано)
   - referenceMax: максимальное референсное значение (если указано)
   - isNormal: true если значение в пределах нормы, false если есть отклонение

6. **Заключение** - выводы, рекомендации, комментарии врача (если есть)

ФОРМАТ ОТВЕТА - строго JSON (без markdown, без комментариев):

{
  "studyType": "название анализа",
  "studyDate": "YYYY-MM-DD",
  "laboratory": "название лаборатории",
  "doctor": "ФИО врача или null",
  "findings": "заключение врача или null",
  "indicators": [
    {
      "name": "Показатель (Аббр)",
      "value": 123.45,
      "unit": "г/л",
      "referenceMin": 120,
      "referenceMax": 160,
      "isNormal": true
    }
  ]
}

ПРАВИЛА:
- Извлекай ВСЕ показатели, которые есть в документе
- Если референсные значения не указаны, используй медицинские стандарты
- Для isNormal сравни value с referenceMin/Max
- Если данные отсутствуют, используй null
- Отвечай ТОЛЬКО JSON, без дополнительного текста
- Не придумывай данные - используй только то, что есть в тексте`

/**
 * Универсальный AI-парсер медицинских документов
 */
export async function parseWithAI(
  ocrText: string,
  config: AIParserConfig
): Promise<ParsedMedicalData> {
  logger.info('Starting AI-powered medical data extraction', 'AI-PARSER', { provider: config.provider, model: config.model || 'default' })
  
  try {
    let response: string
    
    switch (config.provider) {
      case 'ollama':
        response = await parseWithOllama(ocrText, config)
        break
      
      case 'anthropic':
        response = await parseWithClaude(ocrText, config)
        break
      
      case 'local':
        response = await parseWithLocalModel(ocrText, config)
        break
      
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`)
    }
    
    // Парсим JSON-ответ
    const data = JSON.parse(response)
    
    // Валидация и нормализация данных
    const medicalData: ParsedMedicalData = {
      studyType: data.studyType || undefined,
      studyDate: data.studyDate ? new Date(data.studyDate) : undefined,
      laboratory: data.laboratory || undefined,
      doctor: data.doctor || undefined,
      findings: data.findings || undefined,
      indicators: data.indicators || []
    }
    
    logger.info('Successfully extracted indicators', 'AI-PARSER', { count: medicalData.indicators.length, studyType: medicalData.studyType })
    
    return medicalData
    
  } catch (error) {
    logger.error('AI parser error', 'AI-PARSER', error)
    throw error
  }
}

/**
 * Парсинг через Ollama (локальная LLM)
 */
async function parseWithOllama(
  ocrText: string,
  config: AIParserConfig
): Promise<string> {
  const model = config.model || getOllamaModel()
  logger.info('Calling Ollama API', 'AI-PARSER', { model })
  const content = await callOllamaChat({
    system: MEDICAL_EXTRACTION_PROMPT,
    user: `Проанализируй следующий медицинский документ:\n\n${ocrText}`,
    temperature: 0.1,
    model,
    responseFormat: { type: 'json_object' },
  })
  logger.info('Ollama response received', 'AI-PARSER')
  return content
}

/**
 * Парсинг через Anthropic API (Claude)
 */
async function parseWithClaude(
  ocrText: string,
  config: AIParserConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Anthropic API key is required')
  }
  
  const model = config.model || 'claude-3-5-sonnet-20241022'
  
  logger.info('Calling Anthropic API', 'AI-PARSER', { model })
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      temperature: 0.1,
      system: MEDICAL_EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Проанализируй следующий медицинский документ:\n\n${ocrText}`
        }
      ]
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }
  
  const result = await response.json()
  const content = result.content[0].text
  
  logger.info('Claude response received', 'AI-PARSER')
  
  // Claude может вернуть текст с ```json, нужно извлечь JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }
  
  return content
}

/**
 * Парсинг через локальную модель (Ollama, LM Studio и др.)
 */
async function parseWithLocalModel(
  ocrText: string,
  config: AIParserConfig
): Promise<string> {
  const model = config.model || 'llama3.2'
  const endpoint = process.env.LOCAL_LLM_ENDPOINT || 'http://localhost:11434'
  
  logger.info('Calling local LLM', 'AI-PARSER', { model })
  
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      prompt: `${MEDICAL_EXTRACTION_PROMPT}\n\nДокумент:\n${ocrText}`,
      stream: false,
      format: 'json'
    })
  })
  
  if (!response.ok) {
    throw new Error(`Local LLM error: ${response.status}`)
  }
  
  const result = await response.json()
  logger.info('Local LLM response received', 'AI-PARSER')
  
  return result.response
}

/**
 * Получение конфигурации из переменных окружения
 */
export function getAIConfig(): AIParserConfig | null {
  if (process.env.OLLAMA_DISABLED === 'true') {
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      }
    }
    return null
  }

  return {
    provider: 'ollama',
    model: getOllamaModel(),
  }
}

/**
 * Проверка доступности AI-парсера
 */
export function isAIParserAvailable(): boolean {
  return getAIConfig() !== null
}

/**
 * Генерация интеллектуальных комментариев к результатам анализа
 */
export async function generateAnalysisComments(input: {
  studyType?: string
  date?: string
  laboratory?: string
  doctor?: string
  indicators: Array<{
    name: string
    value: string | number
    unit?: string
    referenceMin?: number | null
    referenceMax?: number | null
    isNormal?: boolean | null
  }>
}): Promise<string> {
  const config = getAIConfig()
  if (!config) {
    // Fallback: простая эвристика без AI
    const abnormal = input.indicators.filter(i => i.isNormal === false)
    if (abnormal.length === 0) {
      return 'Все показатели в пределах референсных значений. Рекомендуется продолжать наблюдение согласно плановым осмотрам.'
    }
    const lines = abnormal.map(i => `• ${i.name}: значение ${i.value}${i.unit ? ' ' + i.unit : ''} вне референсных пределов${(i.referenceMin!=null||i.referenceMax!=null) ? ` (${i.referenceMin ?? '—'}–${i.referenceMax ?? '—'})` : ''}.`)
    return [
      'Обнаружены отклонения в следующих показателях:',
      ...lines,
      'Рекомендуется консультация профильного специалиста и повторный анализ через 1–3 месяца.'
    ].join('\n')
  }

  const systemPrompt = `Ты — врач-консультант. По данным лабораторного анализа сформируй короткие клинические комментарии на русском языке (3–6 предложений):
- Укажи какие показатели отклонены и почему это важно.
- Сошлись на клинические рекомендации/Минздрава без указания года/ссылок.
- Дай мягкие действия: повторный анализ, образ жизни, возможная консультация врача.
- Без гипердиагностики и категоричных диагнозов. Без markdown.
`

  const userContent = JSON.stringify({
    studyType: input.studyType,
    date: input.date,
    laboratory: input.laboratory,
    doctor: input.doctor,
    indicators: input.indicators
  })

  try {
    switch (config.provider) {
      case 'ollama': {
        return (
          await callOllamaChat({
            system: systemPrompt,
            user: `Данные анализа (JSON):\n${userContent}`,
            temperature: 0.3,
            model: config.model,
          })
        ).trim() || 'Комментарий недоступен.'
      }
      case 'anthropic': {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey!,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: config.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 600,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: `Данные анализа (JSON):\n${userContent}` }]
          })
        })
        if (!response.ok) {
          const err = await response.text()
          throw new Error(`Anthropic error: ${response.status} ${err}`)
        }
        const json = await response.json()
        return json.content?.[0]?.text?.trim() || 'Комментарий недоступен.'
      }
      case 'local': {
        const endpoint = process.env.LOCAL_LLM_ENDPOINT || 'http://localhost:11434'
        const response = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model || 'llama3.2',
            prompt: `${systemPrompt}\n\nДанные анализа (JSON):\n${userContent}`,
            stream: false
          })
        })
        if (!response.ok) throw new Error(`Local LLM error: ${response.status}`)
        const json = await response.json()
        return (json.response || '').trim() || 'Комментарий недоступен.'
      }
      default:
        return 'Комментарий недоступен.'
    }
  } catch (e) {
    return 'Комментарий недоступен.'
  }
}

