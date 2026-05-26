import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { isResolvePatientErr, resolvePatientId } from '@/lib/caretaker-access'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = req.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const patientIdParam = typeof body?.patientId === 'string' ? body.patientId : null
    const resolved = await resolvePatientId({ payload: decoded, requestedPatientId: patientIdParam, capability: 'medications_write' })
    if (isResolvePatientErr(resolved)) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const existing = await prisma.patientMedication.findFirst({ where: { id: params.id, userId: resolved.patientId } })
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

    const times =
      Array.isArray(body?.times)
        ? body.times
        : typeof body?.times === 'string'
          ? body.times.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined

    const updated = await prisma.patientMedication.update({
      where: { id: params.id },
      data: {
        name: typeof body?.name === 'string' ? body.name.trim() : undefined,
        dosage: typeof body?.dosage === 'string' ? body.dosage : (body?.dosage === null ? null : undefined),
        form: typeof body?.form === 'string' ? body.form : (body?.form === null ? null : undefined),
        route: typeof body?.route === 'string' ? body.route : (body?.route === null ? null : undefined),
        frequencyPerDay: typeof body?.frequencyPerDay === 'number' ? Math.max(1, Math.min(6, Math.floor(body.frequencyPerDay))) : undefined,
        times: times ? (times.length ? times : null) : undefined,
        startDate: body?.startDate ? new Date(body.startDate) : (body?.startDate === null ? null : undefined),
        endDate: body?.endDate ? new Date(body.endDate) : (body?.endDate === null ? null : undefined),
        notes: typeof body?.notes === 'string' ? body.notes : (body?.notes === null ? null : undefined),
        isSupplement: typeof body?.isSupplement === 'boolean' ? body.isSupplement : undefined
      }
    })
    return NextResponse.json({ medication: updated })
  } catch (e) {
    console.error('[medications][PUT] error:', e)
    return NextResponse.json({ error: 'Ошибка обновления лекарства' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const patientIdParam = searchParams.get('patientId')
    const resolved = await resolvePatientId({ payload: decoded, requestedPatientId: patientIdParam, capability: 'medications_write' })
    if (isResolvePatientErr(resolved)) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const existing = await prisma.patientMedication.findFirst({ where: { id: params.id, userId: resolved.patientId } })
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

    await prisma.patientMedication.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[medications][DELETE] error:', e)
    return NextResponse.json({ error: 'Ошибка удаления лекарства' }, { status: 500 })
  }
}


