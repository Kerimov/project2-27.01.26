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

    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: payload.userId }, select: { id: true } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const document = await prisma.document.findUnique({ where: { id: params.id } })
    if (!document) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })

    // Access: doctor must be linked to patient via at least one appointment or patient record
    const [hasRecord, hasAppointment] = await Promise.all([
      prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId: document.userId }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId: document.userId }, select: { id: true } })
    ])
    if (!hasRecord && !hasAppointment) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    return NextResponse.json({
      document: {
        id: document.id,
        userId: document.userId,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        fileUrl: document.fileUrl,
        uploadDate: document.uploadDate,
        parsed: document.parsed,
        studyDate: document.studyDate,
        studyType: document.studyType,
        laboratory: document.laboratory,
        doctor: document.doctor,
        findings: document.findings,
        rawText: document.rawText,
        ocrConfidence: document.ocrConfidence,
        tags: document.tags,
        category: document.category,
        notes: document.notes,
        indicators: document.indicators
      }
    })
  } catch (e) {
    console.error('[doctor/documents][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения документа' }, { status: 500 })
  }
}


