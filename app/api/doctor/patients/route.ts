import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

// Использует request.headers и cookie, поэтому маршрут должен быть динамическим
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7)
    else {
      const cookieHeader = request.headers.get('cookie')
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
      if (cookies.token) token = cookies.token
    }

    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    // Пациенты из карточек
    const records = await prisma.patientRecord.findMany({
      where: { doctorId: doctor.id },
      select: { patientId: true },
    })

    // Пациенты из приемов
    const appts = await prisma.appointment.findMany({
      where: { doctorId: doctor.id },
      select: { patientId: true },
    })

    const ids = Array.from(new Set([...
      records.map(r => r.patientId), ...appts.map(a => a.patientId)
    ].filter(Boolean)))

    if (ids.length === 0) return NextResponse.json({ patients: [] })

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ patients: users })
  } catch (e) {
    console.error('Error listing doctor patients:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7)
    else {
      const cookieHeader = request.headers.get('cookie')
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
      if (cookies.token) token = cookies.token
    }

    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === 'string' ? body.patientId : ''
    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })

    const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, name: true, email: true, role: true } })
    if (!patient) return NextResponse.json({ error: 'Пациент не найден' }, { status: 404 })

    const recordType = typeof body?.recordType === 'string' ? body.recordType : 'consultation'
    const diagnosis = typeof body?.diagnosis === 'string' && body.diagnosis.trim() ? body.diagnosis.trim() : null
    const symptoms = typeof body?.symptoms === 'string' && body.symptoms.trim() ? body.symptoms.trim() : null
    const treatment = typeof body?.treatment === 'string' && body.treatment.trim() ? body.treatment.trim() : null
    const meds = Array.isArray(body?.medications) ? body.medications : null
    const nextVisit = body?.nextVisit ? new Date(body.nextVisit) : null

    const rec = await prisma.patientRecord.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        recordType,
        diagnosis,
        symptoms,
        treatment,
        medications: meds && meds.length ? meds : null,
        nextVisit,
        status: 'active'
      }
    })

    return NextResponse.json({ patientRecord: rec }, { status: 201 })
  } catch (e) {
    console.error('Error creating patient record:', e)
    return NextResponse.json({ error: 'Ошибка при создании записи о пациенте' }, { status: 500 })
  }
}
