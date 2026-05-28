import { prisma } from '@/lib/db'
import { getOllamaModel, getOllamaVisionModel } from '@/lib/ollama'
import { getDeepSeekModel, isDeepSeekConfigured } from '@/lib/deepseek'

/** Провайдеры, реально используемые в коде проекта */
export type AIProviderId = 'deepseek' | 'ollama'

export type ResolvedAISettings = {
  provider: AIProviderId
  model: string
  source: 'database' | 'env'
}

/** Пресеты моделей проекта (чат / парсер / ассистент) */
export type ProjectAiModelPreset = {
  provider: AIProviderId
  model: string
  label: string
  description: string
}

export const PROJECT_AI_MODELS: ProjectAiModelPreset[] = [
  {
    provider: 'deepseek',
    model: 'deepseek-chat',
    label: 'DeepSeek Chat',
    description: 'Облачный AI (DEEPSEEK_API_KEY в .env.local)',
  },
  {
    provider: 'ollama',
    model: 'llama3.2',
    label: 'Ollama Llama 3.2',
    description: 'Локальный AI — ollama serve, ollama pull llama3.2',
  },
]

/** Vision для OCR изображений документов (отдельно от чата) */
export const PROJECT_VISION_MODEL = {
  provider: 'ollama' as const,
  model: 'llava',
  label: 'Ollama LLaVA',
  description: 'Только распознавание текста с фото документов — ollama pull llava',
}

const KEY_PROVIDER = 'ai_provider'
const KEY_MODEL = 'ai_model'
const KEY_VISION_MODEL = 'ai_vision_model'
const KEY_ASSISTANT_CHAT_MODE = 'assistant_chat_mode'
const KEY_ASSISTANT_LLM_ROUTER = 'assistant_llm_router'

export type AssistantChatMode = 'hybrid' | 'agent'

let assistantModeCache: AssistantChatMode | null = null
let assistantModeCacheTime = 0
let assistantLlmRouterCache: boolean | null = null
let assistantLlmRouterCacheTime = 0

let cache: ResolvedAISettings | null = null
let cacheTime = 0
const CACHE_TTL_MS = 2000

function envDefaults(): ResolvedAISettings {
  if (isDeepSeekConfigured()) {
    return { provider: 'deepseek', model: getDeepSeekModel(), source: 'env' }
  }
  return { provider: 'ollama', model: getOllamaModel(), source: 'env' }
}

function parseProvider(value: string | undefined): AIProviderId | null {
  if (value === 'deepseek' || value === 'ollama') return value
  return null
}

function findPreset(provider: AIProviderId, model: string): ProjectAiModelPreset | undefined {
  return PROJECT_AI_MODELS.find((p) => p.provider === provider && p.model === model)
}

export function isProviderReady(provider: AIProviderId): boolean {
  if (provider === 'deepseek') return isDeepSeekConfigured()
  return process.env.OLLAMA_DISABLED !== 'true'
}

/** Готовность с проверкой ollama serve (для админки) */
export async function isProviderReadyAsync(provider: AIProviderId): Promise<boolean> {
  if (provider === 'deepseek') return isDeepSeekConfigured()
  const { isOllamaReachable } = await import('./ollama')
  return isOllamaReachable()
}

/** @deprecated */
export function isProviderConfigured(provider: AIProviderId): boolean {
  return isProviderReady(provider)
}

export function getModelLabel(provider: AIProviderId, modelId: string): string {
  return findPreset(provider, modelId)?.label ?? modelId
}

export async function resolveAISettings(force = false): Promise<ResolvedAISettings> {
  if (!force && cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cache
  }

  const defaults = envDefaults()
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [KEY_PROVIDER, KEY_MODEL] } },
    })
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const provider = parseProvider(map[KEY_PROVIDER]) ?? defaults.provider
    const preset = findPreset(provider, map[KEY_MODEL]?.trim() || '')
    const model = preset?.model ?? defaults.model

    cache = {
      provider,
      model,
      source: map[KEY_PROVIDER] || map[KEY_MODEL] ? 'database' : 'env',
    }
  } catch {
    cache = defaults
  }

  cacheTime = Date.now()
  return cache!
}

export function getResolvedAISettingsSync(): ResolvedAISettings {
  return cache ?? envDefaults()
}

export function invalidateAISettingsCache(): void {
  cache = null
  cacheTime = 0
  assistantModeCache = null
  assistantModeCacheTime = 0
  assistantLlmRouterCache = null
  assistantLlmRouterCacheTime = 0
}

function parseAssistantChatMode(value: string | undefined): AssistantChatMode | null {
  if (value === 'hybrid' || value === 'agent') return value
  return null
}

function envAssistantChatMode(): AssistantChatMode {
  const v = process.env.ASSISTANT_CHAT_MODE?.trim().toLowerCase()
  if (v === 'agent') return 'agent'
  return 'hybrid'
}

export async function resolveAssistantChatMode(force = false): Promise<AssistantChatMode> {
  if (!force && assistantModeCache && Date.now() - assistantModeCacheTime < CACHE_TTL_MS) {
    return assistantModeCache
  }

  let mode: AssistantChatMode = envAssistantChatMode()
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: KEY_ASSISTANT_CHAT_MODE },
    })
    mode = parseAssistantChatMode(row?.value?.trim()) ?? mode
  } catch {
    /* ignore */
  }

  assistantModeCache = mode
  assistantModeCacheTime = Date.now()
  return mode
}

export function getResolvedAssistantChatModeSync(): AssistantChatMode {
  return assistantModeCache ?? envAssistantChatMode()
}

export async function saveAssistantChatMode(mode: AssistantChatMode): Promise<void> {
  if (mode !== 'hybrid' && mode !== 'agent') {
    throw new Error('Режим чата: hybrid или agent')
  }
  await prisma.systemSetting.upsert({
    where: { key: KEY_ASSISTANT_CHAT_MODE },
    create: { key: KEY_ASSISTANT_CHAT_MODE, value: mode },
    update: { value: mode },
  })
  assistantModeCache = mode
  assistantModeCacheTime = Date.now()
}

function envAssistantLlmRouter(): boolean {
  const v = process.env.ASSISTANT_LLM_ROUTER?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

function parseAssistantLlmRouter(value: string | undefined): boolean | null {
  if (value === undefined || value === null) return null
  const v = value.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'on') return true
  if (v === '0' || v === 'false' || v === 'off') return false
  return null
}

/** LLM-router при низкой уверенности rule-router (настройка из админки или .env) */
export async function resolveAssistantLlmRouter(force = false): Promise<boolean> {
  if (!force && assistantLlmRouterCache !== null && Date.now() - assistantLlmRouterCacheTime < CACHE_TTL_MS) {
    return assistantLlmRouterCache
  }

  let enabled = envAssistantLlmRouter()
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: KEY_ASSISTANT_LLM_ROUTER },
    })
    const parsed = parseAssistantLlmRouter(row?.value)
    if (parsed !== null) {
      enabled = parsed
    }
  } catch {
    /* ignore */
  }

  assistantLlmRouterCache = enabled
  assistantLlmRouterCacheTime = Date.now()
  return enabled
}

export function getResolvedAssistantLlmRouterSync(): boolean {
  return assistantLlmRouterCache ?? envAssistantLlmRouter()
}

export async function saveAssistantLlmRouter(enabled: boolean): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: KEY_ASSISTANT_LLM_ROUTER },
    create: { key: KEY_ASSISTANT_LLM_ROUTER, value: enabled ? '1' : '0' },
    update: { value: enabled ? '1' : '0' },
  })
  assistantLlmRouterCache = enabled
  assistantLlmRouterCacheTime = Date.now()
}

export type ResolvedAssistantSettings = {
  chatMode: AssistantChatMode
  llmRouter: boolean
  chatModeSource: 'database' | 'env'
  llmRouterSource: 'database' | 'env'
}

export async function resolveAssistantSettings(force = false): Promise<ResolvedAssistantSettings> {
  const [chatMode, llmRouter] = await Promise.all([
    resolveAssistantChatMode(force),
    resolveAssistantLlmRouter(force),
  ])

  let chatModeSource: 'database' | 'env' = 'env'
  let llmRouterSource: 'database' | 'env' = 'env'
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [KEY_ASSISTANT_CHAT_MODE, KEY_ASSISTANT_LLM_ROUTER] } },
    })
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    if (parseAssistantChatMode(map[KEY_ASSISTANT_CHAT_MODE]?.trim()) !== null) {
      chatModeSource = 'database'
    }
    if (parseAssistantLlmRouter(map[KEY_ASSISTANT_LLM_ROUTER]) !== null) {
      llmRouterSource = 'database'
    }
  } catch {
    /* ignore */
  }

  return { chatMode, llmRouter, chatModeSource, llmRouterSource }
}

/** Agent с tool calling — только DeepSeek */
export async function shouldUseAssistantAgent(): Promise<boolean> {
  await resolveAISettings()
  await resolveAssistantChatMode()
  if (getResolvedAISettingsSync().provider !== 'deepseek') return false
  if (!isDeepSeekConfigured()) return false
  return getResolvedAssistantChatModeSync() === 'agent'
}

export async function saveAISettings(provider: AIProviderId, model: string): Promise<void> {
  const preset = findPreset(provider, model)
  if (!preset) {
    throw new Error('Модель не из списка проекта')
  }

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: KEY_PROVIDER },
      create: { key: KEY_PROVIDER, value: provider },
      update: { value: provider },
    }),
    prisma.systemSetting.upsert({
      where: { key: KEY_MODEL },
      create: { key: KEY_MODEL, value: preset.model },
      update: { value: preset.model },
    }),
  ])
  invalidateAISettingsCache()
  await resolveAISettings(true)
}

/** Модель vision для OCR (из админки или .env) */
export async function resolveVisionModel(): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: KEY_VISION_MODEL },
    })
    if (row?.value === PROJECT_VISION_MODEL.model) return row.value
  } catch {
    /* ignore */
  }
  return getOllamaVisionModel()
}

export async function saveVisionModel(model: string): Promise<void> {
  if (model !== PROJECT_VISION_MODEL.model) {
    throw new Error('Для OCR в проекте используется только llava')
  }
  await prisma.systemSetting.upsert({
    where: { key: KEY_VISION_MODEL },
    create: { key: KEY_VISION_MODEL, value: model },
    update: { value: model },
  })
}
