import {
  callDeepSeekCompletion,
  type DeepSeekChatMessage,
  type DeepSeekToolCall,
} from '@/lib/deepseek'
import { getResolvedAISettingsSync, resolveAISettings } from '@/lib/ai-runtime-settings'
import type { AssistantPatientContext } from '@/lib/ai/assistant-patient-context'
import type { ResolvedIntentDecision } from '@/lib/ai/assistant-intent-resolver'
import type { AssistantIntent } from '@/lib/ai/assistant-router'
import { buildAssistantOpenAiTools } from '@/lib/ai/assistant-openai-tools'
import { getAssistantToolDefinition } from '@/lib/ai/assistant-tools'
import {
  executeAssistantTool,
  type LegacyProjectActionRunner,
} from '@/lib/ai/assistant-tool-executor'
import type { AssistantProjectActionResult } from '@/lib/ai/assistant-extended-actions'
import { canAutoRunSuggestedTool, getIntentForTool } from '@/lib/ai/assistant-tool-routing'

const MAX_AGENT_ITERATIONS = 3

export type AssistantAgentResult = {
  handled: boolean
  text: string
  functionName?: string
  functionResult?: Record<string, unknown>
  provider: string
  model: string
  iterations: number
}

function buildAgentSystemPrompt(intent: AssistantIntent): string {
  return `Ты — ИИ-ассистент персонального медицинского кабинета PMA. Не врач: не ставишь диагнозы и не назначаешь лекарства.

Используй tools для действий в кабинете (записи, дневник, анализы, напоминания, врачи).
Для общих медицинских вопросов без данных ЛК отвечай текстом без tool.
«Запиши в дневник» → add_diary_entry. «Запиши к врачу» → get_doctors / book_appointment.
Запись на приём и удаление данных — только после явного запроса пользователя.

Текущий intent (подсказка): ${intent}.
Отвечай на русском, кратко и по делу.`
}

function historyToMessages(history: unknown): DeepSeekChatMessage[] {
  if (!Array.isArray(history)) return []
  const out: DeepSeekChatMessage[] = []
  for (const item of history.slice(-8)) {
    if (!item || typeof item !== 'object') continue
    const role = (item as { role?: string }).role
    const content = String((item as { content?: string }).content || '').slice(0, 700)
    if (!content) continue
    if (role === 'user') out.push({ role: 'user', content })
    else if (role === 'assistant') out.push({ role: 'assistant', content })
  }
  return out
}

async function executeAgentToolCall(input: {
  call: DeepSeekToolCall
  message: string
  intent: AssistantIntent
  ctx: AssistantPatientContext
  hasUiAction: boolean
  runLegacyProjectAction: LegacyProjectActionRunner
  action?: unknown
  pendingBooking?: unknown
}): Promise<{ payload: string; projectAction: AssistantProjectActionResult | null }> {
  const name = input.call.function.name
  const def = getAssistantToolDefinition(name)
  if (!def) {
    return {
      payload: JSON.stringify({ error: 'unknown_tool', name }),
      projectAction: null,
    }
  }

  if (!canAutoRunSuggestedTool(name, input.message, input.hasUiAction)) {
    return {
      payload: JSON.stringify({
        status: 'needs_confirmation',
        tool: name,
        message:
          'Для этого действия нужно явное подтверждение пользователя. Попросите уточнить или подтвердить.',
      }),
      projectAction: null,
    }
  }

  const effectiveIntent = getIntentForTool(name, input.intent)
  const projectAction = await executeAssistantTool({
    toolName: name,
    message: input.message,
    intent: effectiveIntent,
    ctx: input.ctx,
    hasUiAction: input.hasUiAction,
    action: input.action,
    pendingBooking: input.pendingBooking,
    runLegacyProjectAction: input.runLegacyProjectAction,
  })

  if (!projectAction) {
    return {
      payload: JSON.stringify({
        status: 'no_result',
        tool: name,
        message: 'Не удалось выполнить действие с текущими данными.',
      }),
      projectAction: null,
    }
  }

  return {
    payload: JSON.stringify({
      status: 'ok',
      functionName: projectAction.functionName,
      message: projectAction.message,
      action: projectAction.data?.action ?? null,
    }),
    projectAction,
  }
}

export async function runAssistantAgent(input: {
  message: string
  history?: unknown
  intentDecision: ResolvedIntentDecision
  ctx: AssistantPatientContext
  hasUiAction?: boolean
  action?: unknown
  pendingBooking?: unknown
  runLegacyProjectAction: LegacyProjectActionRunner
}): Promise<AssistantAgentResult | null> {
  await resolveAISettings()
  const settings = getResolvedAISettingsSync()
  if (settings.provider !== 'deepseek') return null

  const tools = buildAssistantOpenAiTools()
  const messages: DeepSeekChatMessage[] = [
    { role: 'system', content: buildAgentSystemPrompt(input.intentDecision.intent) },
    ...historyToMessages(input.history),
    { role: 'user', content: input.message },
  ]

  let lastProjectAction: AssistantProjectActionResult | null = null
  let finalText = ''
  let model = settings.model
  let iterations = 0

  try {
    for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
      iterations = i + 1
      const completion = await callDeepSeekCompletion({
        messages,
        tools,
        toolChoice: 'auto',
        temperature: 0.25,
        model: settings.model,
      })
      model = completion.model

      const assistantMsg = completion.message
      messages.push({
        role: 'assistant',
        content: assistantMsg.content ?? null,
        tool_calls: assistantMsg.tool_calls,
      })

      if (assistantMsg.tool_calls?.length) {
        for (const call of assistantMsg.tool_calls.slice(0, 2)) {
          const { payload, projectAction } = await executeAgentToolCall({
            call,
            message: input.message,
            intent: input.intentDecision.intent,
            ctx: input.ctx,
            hasUiAction: Boolean(input.hasUiAction),
            runLegacyProjectAction: input.runLegacyProjectAction,
            action: input.action,
            pendingBooking: input.pendingBooking,
          })
          if (projectAction) lastProjectAction = projectAction
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: payload,
          })
        }
        continue
      }

      finalText = (assistantMsg.content || '').trim()
      break
    }
  } catch (error) {
    console.error('[assistant-agent]', error instanceof Error ? error.message : error)
    return null
  }

  if (!finalText && lastProjectAction) {
    finalText = lastProjectAction.message
  }

  if (!finalText && !lastProjectAction) {
    return null
  }

  return {
    handled: true,
    text: finalText || 'Готово.',
    functionName: lastProjectAction?.functionName,
    functionResult: lastProjectAction?.data as Record<string, unknown> | undefined,
    provider: 'deepseek',
    model,
    iterations,
  }
}
