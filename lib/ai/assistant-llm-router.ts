import { ASSISTANT_TOOLS } from './assistant-tools'
import { tryAssistantLlm } from './assistant-llm'
import type { AssistantIntent, AssistantIntentDecision } from './assistant-router'

const VALID_INTENTS = new Set<AssistantIntent>([
  'appointments',
  'booking',
  'doctors',
  'reminders',
  'documents',
  'analyses',
  'diary',
  'medications',
  'care_plan',
  'marketplace',
  'profile',
  'settings',
  'app_help',
  'medical_question',
  'analytics',
  'caretaker',
  'knowledge',
  'smalltalk',
  'unknown',
])

const TOOL_NAMES = new Set(ASSISTANT_TOOLS.map((t) => t.name))

export type LlmRouterResult = AssistantIntentDecision & {
  tool: string | null
  needsClarification: boolean
}

export type ChatHistoryTurn = {
  role: 'user' | 'assistant'
  content: string
}

function buildRouterSystemPrompt(): string {
  const intents = [...VALID_INTENTS].join(', ')
  const tools = ASSISTANT_TOOLS.map((t) => t.name).join(', ')
  return `Ты — диспетчер запросов в медицинском личном кабинете. Не отвечай пользователю и не давай медицинских советов.
Верни только JSON.

Допустимые intent: ${intents}
Допустимые tool (или null): ${tools}

Правила:
- «запиши в дневник», метрики боль/сон → intent diary, tool add_diary_entry или null
- «запиши к врачу», «записаться» → intent booking, tool get_doctors или null
- «помогает ли лекарство», «можно ли принимать», симптомы без запроса данных ЛК → intent medical_question, tool null
- «покажи мои анализы/записи/напоминания» → соответствующий intent, read-tool или null
- При сомнении: intent unknown, needsClarification true, confidence ниже 0.6
- tool указывай только если уверен; иначе null`
}

function buildRouterUserPrompt(message: string, history?: ChatHistoryTurn[]): string {
  const lines: string[] = []
  if (history?.length) {
    lines.push('Недавний контекст диалога:')
    for (const turn of history.slice(-4)) {
      const role = turn.role === 'user' ? 'Пользователь' : 'Ассистент'
      const text = (turn.content || '').slice(0, 280)
      lines.push(`${role}: ${text}`)
    }
    lines.push('')
  }
  lines.push(`Текущее сообщение: ${message}`)
  lines.push('')
  lines.push(
    'JSON: {"intent":"...","confidence":0.0-1.0,"reason":"кратко","tool":null|"tool_name","needsClarification":false}'
  )
  return lines.join('\n')
}

function parseRouterJson(raw: string): LlmRouterResult | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const intentRaw = String(parsed.intent || '').trim() as AssistantIntent
    if (!VALID_INTENTS.has(intentRaw)) return null

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0))
    const reason = String(parsed.reason || 'llm router').slice(0, 200)
    const needsClarification = Boolean(parsed.needsClarification)
    let tool: string | null = null
    if (parsed.tool != null && parsed.tool !== '') {
      const name = String(parsed.tool).trim()
      tool = TOOL_NAMES.has(name) ? name : null
    }

    if (needsClarification && confidence > 0.85) {
      return {
        intent: 'unknown',
        confidence: Math.min(confidence, 0.55),
        reason: `${reason} (clarification)`,
        tool: null,
        needsClarification: true,
      }
    }

    return {
      intent: intentRaw,
      confidence,
      reason,
      tool,
      needsClarification,
    }
  } catch {
    return null
  }
}

export async function classifyWithLlmRouter(input: {
  message: string
  history?: ChatHistoryTurn[]
}): Promise<LlmRouterResult | null> {
  const message = (input.message || '').trim()
  if (!message) return null

  const llm = await tryAssistantLlm({
    system: buildRouterSystemPrompt(),
    user: buildRouterUserPrompt(message, input.history),
    temperature: 0,
    responseFormat: { type: 'json_object' },
  })

  if (!llm?.text) return null
  return parseRouterJson(llm.text)
}
