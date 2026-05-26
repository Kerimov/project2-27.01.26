import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'
import { getClinicalProtocol } from '@/lib/clinical-protocols'

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
    prisma.appointment.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
  ])
  return !!(record || appt)
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: payload.userId } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === 'string' ? body.patientId.trim() : ''
    const protocolKey = typeof body?.protocolKey === 'string' ? body.protocolKey.trim() : ''
    const startDate = body?.startDate ? new Date(body.startDate) : new Date()

    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })
    if (!protocolKey) return NextResponse.json({ error: 'protocolKey обязателен' }, { status: 400 })

    const protocol = getClinicalProtocol(protocolKey)
    if (!protocol) return NextResponse.json({ error: 'Неизвестный протокол' }, { status: 400 })

    const ok = await doctorCanAccessPatient(doctor.id, patientId)
    if (!ok) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, role: true } })
    if (!patient) return NextResponse.json({ error: 'Пациент не найден' }, { status: 404 })
    if (patient.role !== 'PATIENT') return NextResponse.json({ error: 'Неверная роль пользователя' }, { status: 400 })

    const created = await prisma.$transaction(async (tx) => {
      const tasks = []
      for (const item of protocol.items) {
        const dueAt = new Date(+startDate + item.dueInDays * 24 * 60 * 60 * 1000)
        const t = await tx.carePlanTask.create({
          data: {
            userId: patientId,
            createdByDoctorId: doctor.id,
            title: item.title,
            description: [
              `Протокол: ${protocol.name}`,
              item.description ? item.description : null,
              'Статус: ожидает согласования пациентом.',
            ].filter(Boolean).join('\n'),
            dueAt,
            recurrence: item.recurrence,
            status: 'ACTIVE',
            approvalStatus: 'PENDING',
            approvalRequestedAt: new Date(),
            protocolKey: protocol.key,
            // channels можно настроить позже/в UI; MVP — null
            channels: null,
          },
        })
        await tx.carePlanCheckIn.create({
          data: {
            taskId: t.id,
            type: 'NOTE',
            reason: `Создано врачом по протоколу "${protocol.name}". Ожидает согласования.`,
          },
        })
        tasks.push(t)
      }
      return tasks
    })

    return NextResponse.json({
      protocol: { key: protocol.key, name: protocol.name },
      createdCount: created.length,
      tasks: created.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt })),
    })
  } catch (e) {
    console.error('[doctor][protocols][apply] error:', e)
    return NextResponse.json({ error: 'Ошибка применения протокола' }, { status: 500 })
  }
}


