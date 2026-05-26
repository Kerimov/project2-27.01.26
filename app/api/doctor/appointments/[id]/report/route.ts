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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId }, select: { id: true } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    // ensure appointment belongs to this doctor
    const appt = await prisma.appointment.findUnique({ where: { id: params.id }, select: { id: true, doctorId: true } })
    if (!appt) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    if (appt.doctorId !== doctor.id) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const dr = await prisma.doctorReport.findUnique({
      where: { appointmentId: appt.id },
      select: { documentId: true, createdAt: true }
    })
    if (!dr) return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 })

    const doc = await prisma.document.findUnique({
      where: { id: dr.documentId },
      select: { id: true, findings: true, rawText: true, fileName: true, studyDate: true }
    })
    if (!doc) return NextResponse.json({ error: 'Документ отчёта не найден' }, { status: 404 })

    const markdown = doc.findings || doc.rawText || ''

    return NextResponse.json({
      documentId: doc.id,
      fileName: doc.fileName,
      createdAt: dr.createdAt,
      markdown
    })
  } catch (e) {
    console.error('[doctor][appointment-report][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения отчёта' }, { status: 500 })
  }
}


