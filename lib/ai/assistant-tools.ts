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
  { name: 'get_analysis_results', description: 'Read patient analyses', risk: 'read', requiresConfirmation: false, permissions: ['analyses_read'] },
  { name: 'get_documents', description: 'Read patient documents', risk: 'read', requiresConfirmation: false, permissions: ['documents_read'] },
  { name: 'get_diary_entries', description: 'Read diary entries', risk: 'read', requiresConfirmation: false, permissions: ['diary_read'] },
  { name: 'add_diary_entry', description: 'Create diary entry', risk: 'write', requiresConfirmation: true, permissions: ['diary_write'] },
  { name: 'get_medications', description: 'Read medications', risk: 'read', requiresConfirmation: false, permissions: ['medications_read'] },
  { name: 'get_care_plan_tasks', description: 'Read care plan tasks', risk: 'read', requiresConfirmation: false, permissions: ['care_plan_read'] },
  { name: 'add_care_plan_task', description: 'Create care plan task', risk: 'write', requiresConfirmation: true, permissions: ['care_plan_write'] },
  { name: 'complete_task', description: 'Mark care plan task complete', risk: 'write', requiresConfirmation: true, permissions: ['care_plan_write'] },
  { name: 'get_reminders', description: 'Read reminders', risk: 'read', requiresConfirmation: false, permissions: ['reminders_read'] },
]

export function getAssistantToolDefinition(name: string): AssistantToolDefinition | null {
  return ASSISTANT_TOOLS.find((tool) => tool.name === name) || null
}
