import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { isResolvePatientErr, resolvePatientId } from '@/lib/caretaker-access'
import { parse as parseCookies } from 'cookie'

export const dynamic = 'force-dynamic'

function getToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = req.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const patientIdParam = searchParams.get('patientId')
    const resolved = await resolvePatientId({ payload: decoded, requestedPatientId: patientIdParam, capability: 'medications_read' })
    if (isResolvePatientErr(resolved)) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const list = await prisma.patientMedication.findMany({
      where: { userId: resolved.patientId },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ medications: list })
  } catch (e) {
    console.error('[medications][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения лекарств' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'name обязателен' }, { status: 400 })

    const times =
      Array.isArray(body?.times)
        ? body.times
        : typeof body?.times === 'string'
          ? body.times.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined

    const created = await prisma.patientMedication.create({
      data: {
        userId: resolved.patientId,
        name,
        dosage: typeof body?.dosage === 'string' ? body.dosage : null,
        form: typeof body?.form === 'string' ? body.form : null,
        route: typeof body?.route === 'string' ? body.route : null,
        frequencyPerDay: typeof body?.frequencyPerDay === 'number' ? Math.max(1, Math.min(6, Math.floor(body.frequencyPerDay))) : null,
        times: times && times.length ? times : null,
        startDate: body?.startDate ? new Date(body.startDate) : null,
        endDate: body?.endDate ? new Date(body.endDate) : null,
        notes: typeof body?.notes === 'string' ? body.notes : null,
        isSupplement: !!body?.isSupplement
      }
    })
    return NextResponse.json({ medication: created }, { status: 201 })
  } catch (e) {
    console.error('[medications][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка создания лекарства' }, { status: 500 })
  }
}


