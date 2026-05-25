/**
 * DeepSeek API (OpenAI-совместимый chat/completions).
 * https://api-docs.deepseek.com/
 */

export type LlmChatParams = {
  system: string
  user: string
  temperature?: number
  model?: string
  responseFormat?: { type: 'json_object' }
}

const DEFAULT_BASE = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'
const TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 90_000)

export function getDeepSeekBaseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE).replace(/\/$/, '')
}

export function getDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL || DEFAULT_MODEL
}

export function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim())
}

/** @deprecated Используйте resolveAISettings(); оставлено для совместимости */
export function shouldUseDeepSeek(): boolean {
  return isDeepSeekConfigured()
}

export async function callDeepSeekChat(params: LlmChatParams): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY не задан')
  }

  const model = params.model || getDeepSeekModel()
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
    body.response_format = params.responseFormat
  }

  const resp = await fetch(`${getDeepSeekBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!resp.ok) {
    const err = await resp.text().catch(() => '')
    throw new Error(`DeepSeek API error: ${resp.status} - ${err || 'проверьте ключ и баланс'}`)
  }

  const json = await resp.json()
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('DeepSeek вернул пустой ответ')
  }
  return text
}

export async function callDeepSeekJson(
  system: string,
  user: string,
  options?: { temperature?: number; model?: string }
): Promise<string> {
  return callDeepSeekChat({
    system,
    user,
    temperature: options?.temperature ?? 0.2,
    model: options?.model,
    responseFormat: { type: 'json_object' },
  })
}
