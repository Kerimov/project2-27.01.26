import { prisma } from '@/lib/db'
import { resolvePatientId, type CareCapability, isResolvePatientErr } from '@/lib/caretaker-access'
import type { TokenPayload } from '@/lib/auth'

export type AssistantPatientContext = {
  actorUserId: string
  patientId: string
  patientName: string | null
  isCaretakerMode: boolean
  prefix: string
}

export async function resolveAssistantPatientContext(params: {
  payload: TokenPayload
  message: string
  explicitPatientId?: string | null
  capability?: CareCapability
}): Promise<AssistantPatientContext | { error: string; status: number }> {
  const capability = params.capability ?? 'diary_read'
  let requested = (params.explicitPatientId || '').trim() || null

  if (!requested) {
    const fromMessage = await matchPatientIdFromMessage(params.payload.userId, params.message)
    if (fromMessage) requested = fromMessage
  }

  const resolved = await resolvePatientId({
    payload: params.payload,
    requestedPatientId: requested,
    capability,
  })
  if (isResolvePatientErr(resolved)) {
    return { error: resolved.error, status: resolved.status }
  }

  const isCaretakerMode = resolved.patientId !== params.payload.userId
  let patientName: string | null = null
  if (isCaretakerMode) {
    const u = await prisma.user.findUnique({
      where: { id: resolved.patientId },
      select: { name: true },
    })
    patientName = u?.name || null
  }

  const prefix = isCaretakerMode && patientName ? `Для пациента ${patientName}: ` : ''

  return {
    actorUserId: params.payload.userId,
    patientId: resolved.patientId,
    patientName,
    isCaretakerMode,
    prefix,
  }
}

async function matchPatientIdFromMessage(caretakerId: string, message: string): Promise<string | null> {
  const t = (message || '').toLowerCase()
  if (!/(?:отец|мать|сын|дочь|родител|бабушк|дедушк|муж|жена|пациент|переключ|для)\s/i.test(t)) {
    return null
  }

  const links = await prisma.careRelationship.findMany({
    where: { caretakerId },
    include: { patient: { select: { id: true, name: true } } },
    take: 20,
  })
  if (links.length === 0) return null
  if (links.length === 1 && /(?:моего|моей|у меня|для)\s/i.test(t)) return links[0].patientId

  for (const link of links) {
    const name = (link.patient.name || '').toLowerCase()
    if (!name) continue
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.some((p) => p.length >= 3 && t.includes(p))) return link.patient.id
    if (t.includes(name)) return link.patient.id
  }
  return null
}
