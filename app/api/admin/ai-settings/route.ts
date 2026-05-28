import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/admin-auth'
import {
  PROJECT_AI_MODELS,
  PROJECT_VISION_MODEL,
  getModelLabel,
  isProviderReadyAsync,
  resolveAISettings,
  resolveAssistantSettings,
  resolveVisionModel,
  saveAISettings,
  saveAssistantChatMode,
  saveAssistantLlmRouter,
  type AIProviderId,
  type AssistantChatMode,
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
  const assistant = await resolveAssistantSettings(true)
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
  const agentAvailable = settings.provider === 'deepseek' && isDeepSeekConfigured()

  return NextResponse.json({
    settings: {
      provider: settings.provider,
      model: settings.model,
      modelLabel: getModelLabel(settings.provider, settings.model),
      source: settings.source,
      assistantChatMode: assistant.chatMode,
      assistantLlmRouter: assistant.llmRouter,
      assistantChatModeSource: assistant.chatModeSource,
      assistantLlmRouterSource: assistant.llmRouterSource,
      agentAvailable,
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
  const assistantChatMode = body?.assistantChatMode as AssistantChatMode | undefined
  const assistantLlmRouter =
    typeof body?.assistantLlmRouter === 'boolean' ? body.assistantLlmRouter : undefined

  const hasModelUpdate = Boolean(provider && model)
  const hasAssistantUpdate = assistantChatMode !== undefined || assistantLlmRouter !== undefined

  if (!hasModelUpdate && !hasAssistantUpdate) {
    return NextResponse.json({ error: 'Нет данных для сохранения' }, { status: 400 })
  }

  if (hasModelUpdate) {
    if (!provider || !['deepseek', 'ollama'].includes(provider)) {
      return NextResponse.json({ error: 'Некорректный провайдер' }, { status: 400 })
    }
    if (!model) {
      return NextResponse.json({ error: 'Укажите модель' }, { status: 400 })
    }
  }

  if (assistantChatMode && assistantChatMode !== 'hybrid' && assistantChatMode !== 'agent') {
    return NextResponse.json({ error: 'Режим чата: hybrid или agent' }, { status: 400 })
  }

  try {
    if (hasModelUpdate) {
      await saveAISettings(provider!, model)
    }
    if (assistantChatMode !== undefined) {
      await saveAssistantChatMode(assistantChatMode)
    }
    if (assistantLlmRouter !== undefined) {
      await saveAssistantLlmRouter(assistantLlmRouter)
    }

    const settings = await resolveAISettings(true)
    const assistant = await resolveAssistantSettings(true)
    const ready = await isProviderReadyAsync(settings.provider)
    const agentAvailable = settings.provider === 'deepseek' && isDeepSeekConfigured()

    const notes: string[] = []
    if (assistant.chatMode === 'agent' && !agentAvailable) {
      notes.push('Режим Agent требует активный DeepSeek (выберите DeepSeek Chat и задайте DEEPSEEK_API_KEY).')
    }
    if (assistant.llmRouter && !ready) {
      notes.push('LLM-router включён, но модель чата сейчас недоступна — проверьте ключ или Ollama.')
    }

    const modeLabel =
      assistant.chatMode === 'agent' ? 'Agent (DeepSeek tools)' : 'Гибрид (правила + shortcuts)'
    const routerLabel = assistant.llmRouter ? 'LLM-router: вкл' : 'LLM-router: выкл'

    return NextResponse.json({
      ok: true,
      settings: {
        provider: settings.provider,
        model: settings.model,
        modelLabel: getModelLabel(settings.provider, settings.model),
        source: settings.source,
        assistantChatMode: assistant.chatMode,
        assistantLlmRouter: assistant.llmRouter,
        assistantChatModeSource: assistant.chatModeSource,
        assistantLlmRouterSource: assistant.llmRouterSource,
        agentAvailable,
      },
      ready,
      message: [
        hasModelUpdate ? `Модель: ${getModelLabel(settings.provider, settings.model)}.` : null,
        hasAssistantUpdate ? `Чат: ${modeLabel}, ${routerLabel}.` : null,
        ...notes,
      ]
        .filter(Boolean)
        .join(' '),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Ошибка сохранения'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
