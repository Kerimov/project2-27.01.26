import type { AssistantIntent } from './assistant-router'
import type { AssistantPatientContext } from './assistant-patient-context'
import {
  tryAssistantExtendedAction,
  type AssistantProjectActionResult,
} from './assistant-extended-actions'
import { getAssistantToolDefinition } from './assistant-tools'
import type { ResolvedIntentDecision } from './assistant-intent-resolver'
import {
  canAutoRunSuggestedTool,
  getIntentForTool,
  isToolResultAcceptable,
  shouldRunSuggestedTool,
} from './assistant-tool-routing'

export type { RouterSource } from './assistant-intent-resolver'
export {
  canAutoRunSuggestedTool,
  getIntentForTool,
  shouldRunSuggestedTool,
} from './assistant-tool-routing'

export type LegacyProjectActionRunner = (params: {
  message: string
  userId: string
  intent: AssistantIntent
  action?: unknown
  pendingBooking?: unknown
  patientPrefix?: string
}) => Promise<AssistantProjectActionResult | null>

export async function executeAssistantTool(input: {
  toolName: string
  message: string
  intent: AssistantIntent
  ctx: AssistantPatientContext
  hasUiAction?: boolean
  runLegacyProjectAction: LegacyProjectActionRunner
  action?: unknown
  pendingBooking?: unknown
}): Promise<AssistantProjectActionResult | null> {
  const def = getAssistantToolDefinition(input.toolName)
  if (!def) return null

  if (!canAutoRunSuggestedTool(input.toolName, input.message, Boolean(input.hasUiAction))) {
    return null
  }

  const effectiveIntent = getIntentForTool(input.toolName, input.intent)

  const extended = await tryAssistantExtendedAction({
    message: input.message,
    intent: effectiveIntent,
    ctx: input.ctx,
  })
  if (extended && isToolResultAcceptable(extended.functionName, input.toolName)) {
    return extended
  }

  const legacy = await input.runLegacyProjectAction({
    message: input.message,
    userId: input.ctx.patientId,
    intent: effectiveIntent,
    action: input.action,
    pendingBooking: input.pendingBooking,
    patientPrefix: input.ctx.prefix,
  })

  if (legacy && isToolResultAcceptable(legacy.functionName, input.toolName)) {
    return legacy
  }

  if (legacy && !def.requiresConfirmation && def.risk === 'read') {
    return legacy
  }

  return null
}

export type AssistantProjectPipelineResult = AssistantProjectActionResult & {
  executionPath: 'llm_tool' | 'extended' | 'legacy' | 'none'
}

export async function runAssistantProjectPipeline(input: {
  message: string
  intentDecision: ResolvedIntentDecision
  ctx: AssistantPatientContext
  bypassShortcut: boolean
  action?: unknown
  pendingBooking?: unknown
  hasUiAction?: boolean
  runLegacyProjectAction: LegacyProjectActionRunner
}): Promise<AssistantProjectPipelineResult | null> {
  if (input.bypassShortcut) return null

  const { intentDecision, ctx, message } = input

  if (
    shouldRunSuggestedTool({
      suggestedTool: intentDecision.suggestedTool,
      routerSource: intentDecision.routerSource,
      bypassShortcut: false,
    })
  ) {
    const fromTool = await executeAssistantTool({
      toolName: intentDecision.suggestedTool!,
      message,
      intent: intentDecision.intent,
      ctx,
      hasUiAction: input.hasUiAction,
      action: input.action,
      pendingBooking: input.pendingBooking,
      runLegacyProjectAction: input.runLegacyProjectAction,
    })
    if (fromTool) {
      return { ...fromTool, executionPath: 'llm_tool' }
    }
  }

  const extended = await tryAssistantExtendedAction({
    message,
    intent: intentDecision.intent,
    ctx,
  })
  if (extended) {
    return { ...extended, executionPath: 'extended' }
  }

  const legacy = await input.runLegacyProjectAction({
    message,
    userId: ctx.patientId,
    intent: intentDecision.intent,
    action: input.action,
    pendingBooking: input.pendingBooking,
    patientPrefix: ctx.prefix,
  })

  if (legacy) {
    return { ...legacy, executionPath: 'legacy' }
  }

  return null
}
