/**
 * Клиент Ollama (OpenAI-совместимый /v1/chat/completions + нативный API).
 * При наличии DEEPSEEK_API_KEY чат/JSON идут в DeepSeek (см. lib/deepseek.ts).
 */

import { callDeepSeekChat, isDeepSeekConfigured } from './deepseek'
import { getResolvedAISettingsSync, resolveAISettings } from './ai-runtime-settings'

const DEFAULT_BASE = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'llama3.2'
const DEFAULT_VISION_MODEL = 'llava'
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 90_000)

export type OllamaChatParams = {
  system: string
  user: string
  temperature?: number
  model?: string
  responseFormat?: { type: 'json_object' }
}

export function getOllamaBaseUrl(): string {
  const raw =
    process.env.OLLAMA_BASE_URL ||
    process.env.LOCAL_LLM_ENDPOINT ||
    DEFAULT_BASE
  return raw.replace(/\/$/, '')
}

export function getOllamaModel(): string {
  return (
    process.env.OLLAMA_MODEL ||
    process.env.LOCAL_LLM_MODEL ||
    DEFAULT_MODEL
  )
}

export function getOllamaVisionModel(): string {
  return process.env.OLLAMA_VISION_MODEL || DEFAULT_VISION_MODEL
}

/** Ollama не выключена в .env (OLLAMA_DISABLED !== true) */
export function isOllamaServiceEnabled(): boolean {
  return process.env.OLLAMA_DISABLED !== 'true'
}

/** Готов ли активный в админке LLM-провайдер */
export function isOllamaConfigured(): boolean {
  const { provider } = getResolvedAISettingsSync()
  if (provider === 'deepseek') return isDeepSeekConfigured()
  return isOllamaServiceEnabled()
}

/** Сервер Ollama отвечает на /api/tags */
export async function isOllamaReachable(): Promise<boolean> {
  if (!isOllamaServiceEnabled()) return false
  try {
    const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Активная модель (из админки) доступна для запросов */
export async function isActiveLlmReady(): Promise<boolean> {
  await resolveAISettings()
  const { provider } = getResolvedAISettingsSync()
  if (provider === 'deepseek') return isDeepSeekConfigured()
  return isOllamaReachable()
}

/** Есть ли vision-модель (llava) в `ollama list` */
export async function isOllamaVisionAvailable(): Promise<boolean> {
  if (!isOllamaServiceEnabled()) return false
  try {
    const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false
    const json = await res.json()
    const want = getOllamaVisionModel().split(':')[0].toLowerCase()
    const models: { name?: string }[] = json?.models || []
    return models.some((m) => (m.name || '').toLowerCase().startsWith(want))
  } catch {
    return false
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.OLLAMA_API_KEY
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

export async function callOllamaChat(params: OllamaChatParams): Promise<string> {
  await resolveAISettings()
  const settings = (await import('./ai-runtime-settings')).getResolvedAISettingsSync()

  if (settings.provider === 'deepseek') {
    if (!isDeepSeekConfigured()) {
      throw new Error('Выбран DeepSeek, но DEEPSEEK_API_KEY не задан в .env.local')
    }
    return callDeepSeekChat({ ...params, model: params.model || settings.model })
  }

  if (!isOllamaServiceEnabled()) {
    throw new Error(
      'Ollama выключена (OLLAMA_DISABLED=true). В .env.local укажите OLLAMA_DISABLED=false и перезапустите npm run dev'
    )
  }
  const reachable = await isOllamaReachable()
  if (!reachable) {
    throw new Error(
      'Ollama не запущена. Выполните: ollama serve && ollama pull llama3.2 (см. OLLAMA_BASE_URL в .env.local)'
    )
  }

  const model = params.model || settings.model || getOllamaModel()
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
    temperature: params.temperature ?? 0.3,
    stream: false,
  }

  if (params.responseFormat?.type === 'json_object') {
    body.format = 'json'
    body.response_format = params.responseFormat
  }

  const resp = await fetch(`${getOllamaBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  })

  if (!resp.ok) {
    const err = await resp.text().catch(() => '')
    throw new Error(
      `Ollama API error: ${resp.status} - ${err || 'проверьте, что Ollama запущена (ollama serve)'}`
    )
  }

  const json = await resp.json()
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Ollama вернула пустой ответ')
  }
  return text
}

export async function callOllamaJson(
  system: string,
  user: string,
  options?: { temperature?: number; model?: string }
): Promise<string> {
  return callOllamaChat({
    system,
    user,
    temperature: options?.temperature ?? 0.2,
    model: options?.model,
    responseFormat: { type: 'json_object' },
  })
}

/** Извлечение текста с изображения (модель с vision, напр. llava) */
export async function callOllamaVision(params: {
  imageBase64: string
  prompt?: string
  model?: string
}): Promise<string> {
  if (!isOllamaServiceEnabled()) {
    throw new Error('Ollama Vision: OLLAMA_DISABLED=true в .env.local')
  }
  const reachable = await isOllamaReachable()
  if (!reachable) {
    throw new Error('Ollama Vision: запустите ollama serve')
  }

  const { resolveVisionModel } = await import('./ai-runtime-settings')
  const model = params.model || (await resolveVisionModel())
  const prompt =
    params.prompt ||
    'Извлеки ПЛОСКИЙ текст из медицинского документа на изображении. Отвечай только текстом без форматирования.'

  const resp = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [params.imageBase64],
        },
      ],
    }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  })

  if (!resp.ok) {
    const err = await resp.text().catch(() => '')
    throw new Error(`Ollama Vision error: ${resp.status} - ${err}`)
  }

  const json = await resp.json()
  const text = json?.message?.content
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Ollama Vision вернула пустой ответ')
  }
  return text
}

export async function fetchImageAsBase64(url: string): Promise<string> {
  const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/s)
  if (dataMatch) {
    return dataMatch[2]
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось загрузить изображение: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.toString('base64')
}
