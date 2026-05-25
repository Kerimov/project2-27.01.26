import { NextResponse } from 'next/server'
import { getAIConfig } from '@/lib/ai-medical-parser'

/**
 * API для проверки доступности AI-парсера
 * Используется в UI для отображения статуса
 */
export async function GET() {
  const config = await getAIConfig()
  
  if (!config) {
    return NextResponse.json({
      available: false,
      provider: 'regex',
      message:
        'Используется базовый regex-парсер. Добавьте DEEPSEEK_API_KEY в .env.local или запустите Ollama (ollama serve).'
    })
  }
  
  return NextResponse.json({
    available: true,
    provider: config.provider,
    model: config.model,
    message: `AI-парсер активен (${config.provider})`
  })
}

