import { ASSISTANT_TOOLS } from './assistant-tools'

export type OpenAiFunctionTool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

const EMPTY_PARAMS = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

/** Каталог tools в формате OpenAI / DeepSeek function calling */
export function buildAssistantOpenAiTools(): OpenAiFunctionTool[] {
  return ASSISTANT_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: `${tool.description} (risk: ${tool.risk}${tool.requiresConfirmation ? ', needs confirmation' : ''})`,
      parameters: { ...EMPTY_PARAMS },
    },
  }))
}
