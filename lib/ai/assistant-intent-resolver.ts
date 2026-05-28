import { classifyAssistantIntent, type AssistantIntentDecision } from './assistant-router'
import { classifyWithLlmRouter, type ChatHistoryTurn } from './assistant-llm-router'
import {
  isAmbiguousForLlmRouter,
  mustUseRuleRouterOnly,
  RULE_ROUTER_MIN_CONFIDENCE,
  shouldPreferLlmOverRule,
} from './assistant-routing-policy'
import { isActiveLlmReady } from '@/lib/ollama'
import { resolveAssistantLlmRouter } from '@/lib/ai-runtime-settings'

export type RouterSource = 'rule' | 'llm' | 'rule_guard'

export type ResolvedIntentDecision = AssistantIntentDecision & {
  routerSource: RouterSource
  suggestedTool: string | null
}

export async function resolveAssistantIntent(input: {
  message: string
  history?: ChatHistoryTurn[]
  hasUiAction?: boolean
  hasPendingBooking?: boolean
}): Promise<ResolvedIntentDecision> {
  const rule = classifyAssistantIntent(input.message)

  if (
    mustUseRuleRouterOnly({
      message: input.message,
      hasUiAction: input.hasUiAction,
      hasPendingBooking: input.hasPendingBooking,
    })
  ) {
    return toResolved(rule, 'rule_guard', null)
  }

  const ruleConfident =
    rule.confidence >= RULE_ROUTER_MIN_CONFIDENCE &&
    !isAmbiguousForLlmRouter(input.message, rule)

  const llmRouterEnabled = await resolveAssistantLlmRouter()
  if (ruleConfident || !llmRouterEnabled) {
    return toResolved(rule, 'rule', null)
  }

  const llmReady = await isActiveLlmReady().catch(() => false)
  if (!llmReady) {
    return toResolved(rule, 'rule', null)
  }

  const llm = await classifyWithLlmRouter({
    message: input.message,
    history: input.history,
  })

  if (!llm) {
    return toResolved(rule, 'rule', null)
  }

  const llmDecision: AssistantIntentDecision = {
    intent: llm.intent,
    confidence: llm.confidence,
    reason: llm.reason,
  }

  if (shouldPreferLlmOverRule(rule, llmDecision)) {
    return toResolved(llmDecision, 'llm', llm.tool)
  }

  return toResolved(rule, 'rule', null)
}

function toResolved(
  decision: AssistantIntentDecision,
  routerSource: RouterSource,
  suggestedTool: string | null
): ResolvedIntentDecision {
  return {
    ...decision,
    routerSource,
    suggestedTool,
  }
}

/** Нормализует history из клиента без PHI в логах */
export function normalizeRouterHistory(history: unknown): ChatHistoryTurn[] {
  if (!Array.isArray(history)) return []
  const turns: ChatHistoryTurn[] = []
  for (const item of history.slice(-6)) {
    if (!item || typeof item !== 'object') continue
    const role = (item as { role?: string }).role
    const content = (item as { content?: string }).content
    if ((role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim()) {
      turns.push({ role, content: content.trim() })
    }
  }
  return turns
}
