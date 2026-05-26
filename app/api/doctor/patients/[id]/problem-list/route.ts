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

async function assertDoctorAndAccess(userId: string, patientId: string) {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId },
    include: {
      patientRecords: {
        where: { patientId },
        take: 1
      }
    }
  })
  if (!doctorProfile) return { ok: false as const, status: 403, error: 'Профиль врача не найден' }
  let patientRecord = doctorProfile.patientRecords[0] || null
  if (!patientRecord) {
    const hasAppointment = await prisma.appointment.findFirst({
      where: { doctorId: doctorProfile.id, patientId },
      select: { id: true }
    })
    if (!hasAppointment) return { ok: false as const, status: 403, error: 'Пациент не прикреплен к врачу' }

    // create minimal record so we can attach notes (history)
    patientRecord = await prisma.patientRecord.create({
      data: {
        doctorId: doctorProfile.id,
        patientId,
        recordType: 'consultation',
        status: 'active'
      }
    })
  }
  return { ok: true as const, doctorProfile, patientRecord }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!content) return NextResponse.json({ error: 'content обязателен' }, { status: 400 })

    const access = await assertDoctorAndAccess(decoded.userId, params.id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const created = await prisma.medicalNote.create({
      data: {
        doctorId: access.doctorProfile.id,
        patientRecordId: access.patientRecord.id,
        title: 'Problem list',
        content,
        noteType: 'problem_list',
        priority: 'normal',
        isPrivate: false
      }
    })

    return NextResponse.json({ note: created }, { status: 201 })
  } catch (e) {
    console.error('[doctor][problem-list][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка сохранения problem list' }, { status: 500 })
  }
}


