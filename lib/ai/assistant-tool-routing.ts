import type { AssistantIntent } from './assistant-router'
import { getAssistantToolDefinition } from './assistant-tools'
import { isDiaryWriteIntent } from './assistant-diary-intent'
type RouterSource = 'rule' | 'llm' | 'rule_guard'

const TOOL_INTENT_MAP: Partial<Record<string, AssistantIntent>> = {
  get_appointments: 'appointments',
  cancel_appointment: 'appointments',
  previsit_questionnaire: 'appointments',
  get_doctors: 'doctors',
  book_appointment: 'booking',
  get_analysis_results: 'analyses',
  get_analysis_detail: 'analyses',
  compare_analyses: 'analyses',
  analysis_triage: 'analyses',
  create_analysis: 'analyses',
  get_documents: 'documents',
  document_upload_hint: 'documents',
  get_diary_entries: 'diary',
  add_diary_entry: 'diary',
  diary_weekly_review: 'diary',
  diary_analysis_link: 'diary',
  get_medications: 'medications',
  add_medication: 'medications',
  delete_medication: 'medications',
  medication_interactions: 'medications',
  get_care_plan_tasks: 'care_plan',
  add_care_plan_task: 'care_plan',
  complete_task: 'care_plan',
  snooze_task: 'care_plan',
  get_reminders: 'reminders',
  create_reminder: 'reminders',
  delete_reminder: 'reminders',
  marketplace_search: 'marketplace',
  knowledge_indicator: 'knowledge',
  dashboard_kpi: 'analytics',
  caretaker_list: 'caretaker',
  medical_report: 'medical_question',
}

export const TOOL_RESULT_ALIASES: Partial<Record<string, string[]>> = {
  get_analysis_detail: ['get_analysis_results'],
  get_doctors: ['select_doctor', 'get_available_slots'],
  book_appointment: ['select_slot', 'confirm_booking'],
}

export function getIntentForTool(toolName: string, fallback: AssistantIntent): AssistantIntent {
  return TOOL_INTENT_MAP[toolName] ?? fallback
}

export function shouldRunSuggestedTool(input: {
  suggestedTool: string | null
  routerSource: RouterSource
  bypassShortcut: boolean
}): boolean {
  if (!input.suggestedTool) return false
  if (input.bypassShortcut) return false
  if (input.routerSource !== 'llm') return false
  return Boolean(getAssistantToolDefinition(input.suggestedTool))
}

export function canAutoRunSuggestedTool(
  toolName: string,
  message: string,
  hasUiAction: boolean
): boolean {
  const def = getAssistantToolDefinition(toolName)
  if (!def) return false
  if (!def.requiresConfirmation) return true
  if (hasUiAction) return true
  if (toolName === 'add_diary_entry' && isDiaryWriteIntent(message)) return true
  if (/(?:создай|добав|удали|отмени|запиш|подтверждаю|напомни\s+мне|внеси)/i.test(message)) {
    return true
  }
  return false
}

export function isToolResultAcceptable(functionName: string, requestedTool: string): boolean {
  if (functionName === requestedTool) return true
  const aliases = TOOL_RESULT_ALIASES[requestedTool]
  return aliases?.includes(functionName) ?? false
}
