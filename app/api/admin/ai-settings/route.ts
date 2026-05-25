import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/admin-auth'
import {
  PROJECT_AI_MODELS,
  PROJECT_VISION_MODEL,
  getModelLabel,
  isProviderReadyAsync,
  resolveAISettings,
  resolveVisionModel,
  saveAISettings,
  type AIProviderId,
} from '@/lib/ai-runtime-settings'
import { isDeepSeekConfigured } from '@/lib/deepseek'
import { isOllamaReachable, isOllamaVisionAvailable } from '@/lib/ollama'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
  }

  const settings = await resolveAISettings(true)
  const visionModel = await resolveVisionModel()

  const models = await Promise.all(
    PROJECT_AI_MODELS.map(async (m) => ({
      ...m,
      ready: await isProviderReadyAsync(m.provider),
      active: settings.provider === m.provider && settings.model === m.model,
    }))
  )

  const ollamaUp = await isOllamaReachable()
  const visionOk = await isOllamaVisionAvailable()

  return NextResponse.json({
    settings: {
      provider: settings.provider,
      model: settings.model,
      modelLabel: getModelLabel(settings.provider, settings.model),
      source: settings.source,
    },
    models,
    vision: {
      ...PROJECT_VISION_MODEL,
      model: visionModel,
      ready: visionOk,
    },
    ollama: {
      enabled: process.env.OLLAMA_DISABLED !== 'true',
      reachable: ollamaUp,
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      chatModel: process.env.OLLAMA_MODEL || 'llama3.2',
      visionModel: visionModel,
    },
    envHints: {
      deepseek: isDeepSeekConfigured(),
      ollama: ollamaUp,
    },
  })
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const provider = body?.provider as AIProviderId | undefined
  const model = typeof body?.model === 'string' ? body.model.trim() : ''

  if (!provider || !['deepseek', 'ollama'].includes(provider)) {
    return NextResponse.json({ error: 'Некорректный провайдер' }, { status: 400 })
  }
  if (!model) {
    return NextResponse.json({ error: 'Укажите модель' }, { status: 400 })
  }

  try {
    await saveAISettings(provider, model)
    const settings = await resolveAISettings(true)
    const ready = await isProviderReadyAsync(settings.provider)
    return NextResponse.json({
      ok: true,
      settings: {
        provider: settings.provider,
        model: settings.model,
        modelLabel: getModelLabel(settings.provider, settings.model),
        source: settings.source,
      },
      ready,
      message: ready
        ? `Активна: ${getModelLabel(settings.provider, settings.model)}`
        : `Сохранено: ${getModelLabel(settings.provider, settings.model)}. Настройте .env.local для запросов.`,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Ошибка сохранения'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
