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

function channelsFromPref(pref: { email: boolean; push: boolean; sms: boolean } | null | undefined) {
  const channels = [pref?.email ? 'EMAIL' : null, pref?.push ? 'PUSH' : null, pref?.sms ? 'SMS' : null].filter(Boolean)
  return channels.length ? channels : ['PUSH']
}

function atLocalHour(date: Date, hour: number, minute: number) {
  const d = new Date(date)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function doctorCanAccessPatient(doctorId: string, patientId: string) {
  const [record, appt] = await Promise.all([
    prisma.patientRecord.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
    prisma.appointment.findFirst({ where: { doctorId, patientId }, select: { id: true } })
  ])
  return !!(record || appt)
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId }, select: { id: true, user: { select: { name: true } } } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === 'string' ? body.patientId.trim() : ''
    const type = typeof body?.type === 'string' ? body.type : ''
    const appointmentId = typeof body?.appointmentId === 'string' ? body.appointmentId.trim() : ''
    const note = typeof body?.note === 'string' ? body.note.slice(0, 800) : ''

    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })
    if (!type) return NextResponse.json({ error: 'type обязателен' }, { status: 400 })

    const ok = await doctorCanAccessPatient(doctor.id, patientId)
    if (!ok) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, role: true, name: true } })
    if (!patient) return NextResponse.json({ error: 'Пациент не найден' }, { status: 404 })
    if (patient.role !== 'PATIENT') return NextResponse.json({ error: 'Неверная роль пользователя' }, { status: 400 })

    const now = new Date()
    const pref = await prisma.reminderPreference.findUnique({ where: { userId: patientId }, select: { email: true, push: true, sms: true } })
    const channels = channelsFromPref(pref)

    if (type === 'PREVISIT_QUESTIONNAIRE') {
      if (!appointmentId) return NextResponse.json({ error: 'appointmentId обязателен для анкеты' }, { status: 400 })
      const appt = await prisma.appointment.findFirst({
        where: { id: appointmentId, doctorId: doctor.id, patientId },
        select: { id: true, scheduledAt: true }
      })
      if (!appt) return NextResponse.json({ error: 'Приём не найден' }, { status: 404 })

      const dueAt = new Date(appt.scheduledAt.getTime() - 48 * 60 * 60 * 1000)
      const safeDue = dueAt.getTime() > now.getTime() ? dueAt : new Date(now.getTime() + 10 * 60 * 1000)

      const created = await prisma.$transaction(async (tx) => {
        const task = await tx.carePlanTask.create({
          data: {
            userId: patientId,
            createdByDoctorId: doctor.id,
            kind: 'REQUEST',
            requestType: 'PREVISIT_QUESTIONNAIRE',
            meta: { appointmentId: appt.id },
            title: 'Заполнить анкету перед визитом',
            description: [
              `Запрос от врача: ${doctor.user.name}.`,
              'Пожалуйста, заполните анкету за 24–48 часов до приёма.',
              note ? `Комментарий: ${note}` : null,
              `Ссылка: /pre-visit/${appt.id}`
            ].filter(Boolean).join('\n'),
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            dueAt: safeDue,
            recurrence: 'NONE'
          }
        })
        await tx.carePlanCheckIn.create({ data: { taskId: task.id, type: 'NOTE', reason: 'Запрос создан врачом.' } })
        await tx.reminder.create({
          data: {
            userId: patientId,
            title: 'Анкета перед визитом',
            description: `Заполните анкету перед визитом (приём: ${new Date(appt.scheduledAt).toLocaleString('ru-RU')}). Откройте: /pre-visit/${appt.id}`,
            dueAt: safeDue,
            recurrence: 'NONE',
            channels
          }
        })
        return task
      })

      return NextResponse.json({ request: { id: created.id, type }, dueAt: created.dueAt })
    }

    if (type === 'BP_7_DAYS') {
      const startDate = now
      const dueAt = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)

      const created = await prisma.$transaction(async (tx) => {
        const task = await tx.carePlanTask.create({
          data: {
            userId: patientId,
            createdByDoctorId: doctor.id,
            kind: 'REQUEST',
            requestType: 'BP_7_DAYS',
            meta: { startDate: startDate.toISOString(), days: 7 },
            title: 'Добавить давление 7 дней',
            description: [
              `Запрос от врача: ${doctor.user.name}.`,
              'Пожалуйста, внесите давление (сист./диаст.) и пульс 1–2 раза в день в дневник.',
              note ? `Комментарий: ${note}` : null,
              'Ссылка: /diary'
            ].filter(Boolean).join('\n'),
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            dueAt,
            recurrence: 'NONE'
          }
        })
        await tx.carePlanCheckIn.create({ data: { taskId: task.id, type: 'NOTE', reason: 'Запрос создан врачом.' } })

        // 7 напоминаний в 09:00 на каждый день (локальное время сервера)
        for (let i = 0; i < 7; i++) {
          const day = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
          const remindAt = atLocalHour(day, 9, 0)
          if (remindAt.getTime() <= now.getTime()) continue
          await tx.reminder.create({
            data: {
              userId: patientId,
              title: 'Давление: внесите показатель',
              description: 'Запрос врача: добавьте давление/пульс в дневник. Откройте: /diary',
              dueAt: remindAt,
              recurrence: 'NONE',
              channels
            }
          })
        }

        return task
      })

      return NextResponse.json({ request: { id: created.id, type }, dueAt: created.dueAt })
    }

    if (type === 'UPLOAD_ANALYSIS') {
      const dueAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
      const remindAt = atLocalHour(new Date(now.getTime() + 24 * 60 * 60 * 1000), 10, 0)

      const created = await prisma.$transaction(async (tx) => {
        const task = await tx.carePlanTask.create({
          data: {
            userId: patientId,
            createdByDoctorId: doctor.id,
            kind: 'REQUEST',
            requestType: 'UPLOAD_ANALYSIS',
            meta: { requestedAt: now.toISOString() },
            title: 'Загрузить анализ/документ',
            description: [
              `Запрос от врача: ${doctor.user.name}.`,
              'Пожалуйста, загрузите анализ/документ в раздел “Документы”.',
              note ? `Комментарий: ${note}` : null,
              'Ссылка: /documents'
            ].filter(Boolean).join('\n'),
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            dueAt,
            recurrence: 'NONE'
          }
        })
        await tx.carePlanCheckIn.create({ data: { taskId: task.id, type: 'NOTE', reason: 'Запрос создан врачом.' } })
        if (remindAt.getTime() > now.getTime()) {
          await tx.reminder.create({
            data: {
              userId: patientId,
              title: 'Загрузите анализ',
              description: 'Запрос врача: загрузите анализ/документ. Откройте: /documents',
              dueAt: remindAt,
              recurrence: 'NONE',
              channels
            }
          })
        }
        return task
      })

      return NextResponse.json({ request: { id: created.id, type }, dueAt: created.dueAt })
    }

    return NextResponse.json({ error: 'Неизвестный type' }, { status: 400 })
  } catch (e) {
    console.error('[doctor][requests][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка создания запроса' }, { status: 500 })
  }
}


