/**
 * Клиент Ollama (OpenAI-совместимый /v1/chat/completions + нативный API).
 */

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

/** AI включён, если не задан OLLAMA_DISABLED=true */
export function isOllamaConfigured(): boolean {
  return process.env.OLLAMA_DISABLED !== 'true'
}

export async function isOllamaReachable(): Promise<boolean> {
  if (!isOllamaConfigured()) return false
  try {
    const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Есть ли vision-модель (llava и т.п.) в `ollama list` */
export async function isOllamaVisionAvailable(): Promise<boolean> {
  if (!isOllamaConfigured()) return false
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
  if (!isOllamaConfigured()) {
    throw new Error('Ollama отключён (OLLAMA_DISABLED=true)')
  }

  const model = params.model || getOllamaModel()
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
  if (!isOllamaConfigured()) {
    throw new Error('Ollama отключён (OLLAMA_DISABLED=true)')
  }

  const model = params.model || getOllamaVisionModel()
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
