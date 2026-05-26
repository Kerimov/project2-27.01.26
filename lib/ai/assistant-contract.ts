export type AssistantCard =
  | {
      type: 'list'
      title: string
      items: Array<Record<string, unknown>>
      emptyText?: string
    }
  | {
      type: 'summary'
      title: string
      body: string
    }

export type AssistantUiAction = {
  id: string
  label: string
  type: 'link' | 'assistant_action'
  href?: string
  payload?: Record<string, unknown>
  requiresConfirmation?: boolean
}

export type AssistantSafety = {
  level: 'info' | 'caution' | 'urgent'
  message: string
}

export type AssistantSource = {
  sourceType?: 'document' | 'analysis' | 'diary' | 'knowledge' | 'app' | 'marketplace'
  id?: string
  label?: string
  date?: string | null
  url?: string | null
  snippet?: string
}

export type AssistantResponseContract = {
  text: string
  cards?: AssistantCard[]
  actions?: AssistantUiAction[]
  sources?: AssistantSource[]
  safety?: AssistantSafety
  requiresConfirmation?: boolean
  requestId?: string
  provider?: string
}

export function toLegacyAssistantResponse(contract: AssistantResponseContract, extra?: Record<string, unknown>) {
  return {
    response: contract.text,
    cards: contract.cards,
    actions: contract.actions,
    safety: contract.safety,
    requiresConfirmation: contract.requiresConfirmation,
    requestId: contract.requestId,
    provider: contract.provider,
    ...(extra || {}),
  }
}
