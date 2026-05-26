export function makeAssistantRequestId() {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function logAssistantEvent(
  event: string,
  data: Record<string, unknown>
) {
  // Keep PHI out of logs: callers should pass metadata only, not message text or medical content.
  console.info('[ai-assistant]', event, data)
}
