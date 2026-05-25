import { NextResponse } from 'next/server'
import { getAIConfig } from '@/lib/ai-medical-parser'

/**
 * API для проверки доступности AI-парсера
 * Используется в UI для отображения статуса
 */
export async function GET() {
  const config = getAIConfig()
  
  if (!config) {
    return NextResponse.json({
      available: false,
      provider: 'regex',
      message: 'Используется базовый regex-парсер. Запустите Ollama (ollama serve) и модель (ollama pull llama3.2)'
    })
  }
  
  return NextResponse.json({
    available: true,
    provider: config.provider,
    model: config.model,
    message: `AI-парсер активен (${config.provider})`
  })
}

