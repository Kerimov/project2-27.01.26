import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

async function assertAccessToAppointment(userId: string, appointmentId: string) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, patientId: true, doctorId: true }
  })
  if (!appt) return { ok: false as const, status: 404 as const, error: 'Запись не найдена' }

  if (appt.patientId === userId) return { ok: true as const, appointment: appt, role: 'PATIENT' as const }

  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } })
  if (doctorProfile?.id && doctorProfile.id === appt.doctorId) {
    return { ok: true as const, appointment: appt, role: 'DOCTOR' as const }
  }

  return { ok: false as const, status: 403 as const, error: 'Доступ запрещён' }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const access = await assertAccessToAppointment(payload.userId, params.id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const q = await prisma.preVisitQuestionnaire.findUnique({
      where: { appointmentId: params.id }
    })

    return NextResponse.json({ questionnaire: q })
  } catch (e) {
    console.error('[previsit][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения анкеты' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const access = await assertAccessToAppointment(payload.userId, params.id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    // только пациент может заполнять
    if (access.role !== 'PATIENT') return NextResponse.json({ error: 'Заполнять анкету может только пациент' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const answers = body?.answers
    const submitted = !!body?.submitted

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'answers обязателен (object)' }, { status: 400 })
    }

    const q = await prisma.preVisitQuestionnaire.upsert({
      where: { appointmentId: params.id },
      create: {
        appointmentId: params.id,
        patientId: access.appointment.patientId,
        doctorId: access.appointment.doctorId,
        answers,
        submittedAt: submitted ? new Date() : null
      },
      update: {
        answers,
        ...(submitted ? { submittedAt: new Date() } : {})
      }
    })

    return NextResponse.json({ questionnaire: q })
  } catch (e) {
    console.error('[previsit][PUT] error:', e)
    return NextResponse.json({ error: 'Ошибка сохранения анкеты' }, { status: 500 })
  }
}


