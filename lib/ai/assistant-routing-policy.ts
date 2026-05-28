import type { AssistantIntentDecision } from './assistant-router'
import { isDiaryWriteIntent } from './assistant-diary-intent'
import { isGeneralMedicalQuestion } from './assistant-medical-intent'

/** Минимальная уверенность rule-router, чтобы не вызывать LLM */
export const RULE_ROUTER_MIN_CONFIDENCE = 0.9

/** @deprecated Используйте resolveAssistantLlmRouter() из ai-runtime-settings */
export function isLlmRouterEnabled(): boolean {
  const v = process.env.ASSISTANT_LLM_ROUTER?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

export function mustUseRuleRouterOnly(input: {
  message: string
  hasUiAction?: boolean
  hasPendingBooking?: boolean
}): boolean {
  if (input.hasUiAction) return true
  if (input.hasPendingBooking) return true
  if (isDiaryWriteIntent(input.message)) return true
  return false
}

/** Rule и LLM могут разойтись — нужен LLM-router */
export function isAmbiguousForLlmRouter(message: string, rule: AssistantIntentDecision): boolean {
  if (rule.confidence < RULE_ROUTER_MIN_CONFIDENCE) return true
  if (rule.intent === 'unknown') return true

  if (rule.intent === 'diary' && isGeneralMedicalQuestion(message)) return true
  if (rule.intent === 'booking' && isDiaryWriteIntent(message)) return true
  if (rule.intent === 'doctors' && isDiaryWriteIntent(message)) return true
  if (rule.intent === 'medical_question' && /(?:дневник|запиши\s+в\s+дневник)/i.test(message)) {
    return true
  }

  return false
}

export function shouldPreferLlmOverRule(
  rule: AssistantIntentDecision,
  llm: AssistantIntentDecision
): boolean {
  if (rule.intent === 'unknown') return true
  if (rule.confidence < 0.7) return llm.confidence >= 0.75
  return llm.confidence >= RULE_ROUTER_MIN_CONFIDENCE
}
