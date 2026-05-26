import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'
import { prescriptionsToMarkdown } from '@/lib/prescription-sheet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

async function doctorCanAccessPatient(doctorId: string, patientId: string) {
  const [record, appt] = await Promise.all([
    prisma.patientRecord.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
    prisma.appointment.findFirst({ where: { doctorId, patientId }, select: { id: true } })
  ])
  return !!(record || appt)
}

async function getDoctorAndPatient(request: NextRequest, patientId: string) {
  const token = getToken(request)
  if (!token) return { ok: false as const, status: 401, error: 'Не авторизован' }
  const decoded = verifyToken(token)
  if (!decoded?.userId) return { ok: false as const, status: 401, error: 'Неверный токен' }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: decoded.userId },
    select: { id: true, user: { select: { name: true } } }
  })
  if (!doctor) return { ok: false as const, status: 403, error: 'Профиль врача не найден' }

  const ok = await doctorCanAccessPatient(doctor.id, patientId)
  if (!ok) return { ok: false as const, status: 403, error: 'Нет доступа к пациенту' }

  const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, name: true } })
  if (!patient) return { ok: false as const, status: 404, error: 'Пациент не найден' }

  return { ok: true as const, doctor, patient }
}

async function loadPrescriptionsForDoctorPatient(doctorId: string, patientId: string) {
  const records = await prisma.patientRecord.findMany({
    where: { doctorId, patientId },
    select: { id: true },
    orderBy: { createdAt: 'desc' }
  })
  const ids = records.map((r) => r.id)
  if (ids.length === 0) return []

  return prisma.prescription.findMany({
    where: { patientRecordId: { in: ids } },
    orderBy: { prescribedAt: 'desc' }
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = (searchParams.get('patientId') || '').trim()
    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })

    const resolved = await getDoctorAndPatient(request, patientId)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })

    const prescriptions = await loadPrescriptionsForDoctorPatient(resolved.doctor.id, patientId)
    const markdown = prescriptionsToMarkdown({
      patientName: resolved.patient.name,
      doctorName: resolved.doctor.user.name,
      generatedAtIso: new Date().toISOString(),
      prescriptions
    })

    return NextResponse.json({ markdown, count: prescriptions.length })
  } catch (e) {
    console.error('[doctor][prescriptions][sheet][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка генерации листа назначений' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === 'string' ? body.patientId.trim() : ''
    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })

    const resolved = await getDoctorAndPatient(request, patientId)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })

    const prescriptions = await loadPrescriptionsForDoctorPatient(resolved.doctor.id, patientId)
    const markdown = prescriptionsToMarkdown({
      patientName: resolved.patient.name,
      doctorName: resolved.doctor.user.name,
      generatedAtIso: new Date().toISOString(),
      prescriptions
    })

    const buf = Buffer.from(markdown, 'utf-8')
    const fileUrl = `data:text/markdown;base64,${buf.toString('base64')}`
    const fileName = `Лист назначений — ${new Date().toLocaleDateString('ru-RU')}.md`

    const doc = await prisma.document.create({
      data: {
        userId: patientId,
        fileName,
        fileType: 'text/markdown',
        fileSize: buf.length,
        fileUrl,
        parsed: true,
        category: 'prescription_sheet',
        studyType: 'Лист назначений',
        studyDate: new Date(),
        findings: markdown,
      },
      select: { id: true }
    })

    return NextResponse.json({ documentId: doc.id, fileName })
  } catch (e) {
    console.error('[doctor][prescriptions][sheet][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка отправки листа пациенту' }, { status: 500 })
  }
}


