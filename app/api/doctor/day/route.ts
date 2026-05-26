import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || request.cookies.get('token')?.value || null
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId }, select: { id: true } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const now = new Date()
    const todayStart = startOfDay(now)
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowEnd = endOfDay(tomorrow)

    const appts = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        scheduledAt: { gte: todayStart, lte: tomorrowEnd },
        status: { not: 'cancelled' }
      },
      include: { preVisit: { select: { id: true, submittedAt: true, updatedAt: true } } },
      orderBy: { scheduledAt: 'asc' }
    })

    const apptIds = appts.map((a) => a.id)
    const reports = apptIds.length
      ? await prisma.doctorReport.findMany({
          where: { appointmentId: { in: apptIds } },
          select: { appointmentId: true, documentId: true, createdAt: true }
        })
      : []
    const reportByApptId = new Map(reports.map((r) => [r.appointmentId, { documentId: r.documentId, createdAt: r.createdAt }]))

    const patientIds = Array.from(new Set(appts.map((a) => a.patientId).filter(Boolean)))
    const analyses = patientIds.length
      ? await prisma.analysis.findMany({
          where: { userId: { in: patientIds } },
          select: { id: true, userId: true, title: true, status: true, date: true },
          orderBy: [{ userId: 'asc' }, { date: 'desc' }]
        })
      : []

    const latestByPatient = new Map<string, { id: string; title: string; status: string; date: Date }>()
    for (const a of analyses) {
      if (!latestByPatient.has(a.userId)) {
        latestByPatient.set(a.userId, { id: a.id, title: a.title, status: a.status, date: a.date as unknown as Date })
      }
    }

    const items = appts.map((a) => {
      const la = latestByPatient.get(a.patientId) || null
      return {
        id: a.id,
        scheduledAt: a.scheduledAt,
        appointmentType: a.appointmentType,
        status: a.status,
        patientId: a.patientId,
        patientName: a.patientName,
        patientEmail: a.patientEmail,
        patientPhone: a.patientPhone,
        preVisit: a.preVisit ? { submittedAt: a.preVisit.submittedAt, updatedAt: a.preVisit.updatedAt } : null,
        doctorReport: reportByApptId.get(a.id) || null,
        lastAnalysis: la
          ? { id: la.id, title: la.title, status: la.status, date: la.date }
          : null
      }
    })

    return NextResponse.json({ todayStart, tomorrowEnd, appointments: items })
  } catch (e) {
    console.error('[doctor/day] error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки дня' }, { status: 500 })
  }
}


