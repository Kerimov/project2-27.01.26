import { callOllamaChat } from '@/lib/ollama'
import { getResolvedAISettingsSync, resolveAISettings } from '@/lib/ai-runtime-settings'

export type AssistantLlmResult = {
  text: string
  provider: string
  model: string
  latencyMs: number
}

export async function callAssistantLlm(params: {
  system: string
  user: string
  temperature?: number
  responseFormat?: { type: 'json_object' }
}): Promise<AssistantLlmResult> {
  await resolveAISettings()
  const settings = getResolvedAISettingsSync()
  const started = Date.now()
  const text = await callOllamaChat({
    system: params.system,
    user: params.user,
    temperature: params.temperature,
    responseFormat: params.responseFormat,
    model: settings.model,
  })

  return {
    text,
    provider: settings.provider,
    model: settings.model,
    latencyMs: Date.now() - started,
  }
}

export async function tryAssistantLlm(params: {
  system: string
  user: string
  temperature?: number
  responseFormat?: { type: 'json_object' }
}): Promise<AssistantLlmResult | null> {
  try {
    return await callAssistantLlm(params)
  } catch (error) {
    console.error('[assistant-llm] provider failed:', error instanceof Error ? error.message : error)
    return null
  }
}
