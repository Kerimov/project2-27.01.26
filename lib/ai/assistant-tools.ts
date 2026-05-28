export type AssistantToolRisk = 'read' | 'write' | 'high'

export type AssistantToolDefinition = {
  name: string
  description: string
  risk: AssistantToolRisk
  requiresConfirmation: boolean
  permissions: string[]
}

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  { name: 'get_appointments', description: 'Read patient appointments', risk: 'read', requiresConfirmation: false, permissions: ['appointments_read'] },
  { name: 'get_doctors', description: 'Read active doctors', risk: 'read', requiresConfirmation: false, permissions: ['doctors_read'] },
  { name: 'book_appointment', description: 'Create an appointment after slot confirmation', risk: 'high', requiresConfirmation: true, permissions: ['appointments_write'] },
  { name: 'cancel_appointment', description: 'Cancel upcoming appointment', risk: 'write', requiresConfirmation: true, permissions: ['appointments_write'] },
  { name: 'previsit_questionnaire', description: 'Pre-visit questionnaire', risk: 'write', requiresConfirmation: false, permissions: ['appointments_write'] },
  { name: 'get_analysis_results', description: 'Read patient analyses', risk: 'read', requiresConfirmation: false, permissions: ['analyses_read'] },
  { name: 'get_analysis_detail', description: 'Analysis detail card', risk: 'read', requiresConfirmation: false, permissions: ['analyses_read'] },
  { name: 'compare_analyses', description: 'Compare analyses over time', risk: 'read', requiresConfirmation: false, permissions: ['analyses_read'] },
  { name: 'analysis_triage', description: 'Urgency triage for results', risk: 'read', requiresConfirmation: false, permissions: ['analyses_read'] },
  { name: 'create_analysis', description: 'Create manual analysis entry', risk: 'write', requiresConfirmation: true, permissions: ['analyses_write'] },
  { name: 'get_documents', description: 'Read patient documents', risk: 'read', requiresConfirmation: false, permissions: ['documents_read'] },
  { name: 'document_upload_hint', description: 'Document upload guidance', risk: 'read', requiresConfirmation: false, permissions: ['documents_read'] },
  { name: 'get_diary_entries', description: 'Read diary entries', risk: 'read', requiresConfirmation: false, permissions: ['diary_read'] },
  { name: 'add_diary_entry', description: 'Create diary entry', risk: 'write', requiresConfirmation: true, permissions: ['diary_write'] },
  { name: 'diary_weekly_review', description: 'Weekly diary review', risk: 'read', requiresConfirmation: false, permissions: ['diary_read'] },
  { name: 'diary_analysis_link', description: 'Link diary with analyses', risk: 'read', requiresConfirmation: false, permissions: ['diary_read'] },
  { name: 'get_medications', description: 'Read medications', risk: 'read', requiresConfirmation: false, permissions: ['medications_read'] },
  { name: 'add_medication', description: 'Add medication', risk: 'write', requiresConfirmation: true, permissions: ['medications_write'] },
  { name: 'delete_medication', description: 'Remove medication from list', risk: 'write', requiresConfirmation: true, permissions: ['medications_write'] },
  { name: 'medication_interactions', description: 'Check drug interactions (informational)', risk: 'read', requiresConfirmation: false, permissions: ['medications_read'] },
  { name: 'get_care_plan_tasks', description: 'Read care plan tasks', risk: 'read', requiresConfirmation: false, permissions: ['care_plan_read'] },
  { name: 'add_care_plan_task', description: 'Create care plan task', risk: 'write', requiresConfirmation: true, permissions: ['care_plan_write'] },
  { name: 'complete_task', description: 'Mark care plan task complete', risk: 'write', requiresConfirmation: true, permissions: ['care_plan_write'] },
  { name: 'snooze_task', description: 'Snooze care plan task', risk: 'write', requiresConfirmation: true, permissions: ['care_plan_write'] },
  { name: 'get_reminders', description: 'Read reminders', risk: 'read', requiresConfirmation: false, permissions: ['reminders_read'] },
  { name: 'create_reminder', description: 'Create reminder', risk: 'write', requiresConfirmation: true, permissions: ['reminders_write'] },
  { name: 'delete_reminder', description: 'Delete reminder', risk: 'write', requiresConfirmation: true, permissions: ['reminders_write'] },
  { name: 'marketplace_search', description: 'Search clinics/labs', risk: 'read', requiresConfirmation: false, permissions: ['marketplace_read'] },
  { name: 'knowledge_indicator', description: 'Explain lab indicator', risk: 'read', requiresConfirmation: false, permissions: ['knowledge_read'] },
  { name: 'dashboard_kpi', description: 'Patient dashboard KPI', risk: 'read', requiresConfirmation: false, permissions: ['analytics_read'] },
  { name: 'medical_report', description: 'Generate medical summary report', risk: 'read', requiresConfirmation: false, permissions: ['reports_read'] },
  { name: 'caretaker_list', description: 'List caretaker linked patients', risk: 'read', requiresConfirmation: false, permissions: ['caretaker_read'] },
]

export function getAssistantToolDefinition(name: string): AssistantToolDefinition | null {
  return ASSISTANT_TOOLS.find((tool) => tool.name === name) || null
}
