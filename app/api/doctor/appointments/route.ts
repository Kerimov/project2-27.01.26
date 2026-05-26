import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parse as parseCookies } from 'cookie'

// Использует headers/cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      const cookieHeader = request.headers.get('cookie')
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
      if (cookies.token) token = cookies.token
    }

    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является врачом
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId }
    })

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 404 })
    }

    // Получаем записи на прием к врачу
    const appointments = await prisma.appointment.findMany({
      where: { doctorId: doctorProfile.id },
      include: { preVisit: { select: { id: true, submittedAt: true, updatedAt: true } } },
      orderBy: { scheduledAt: 'desc' }
    })

    const apptIds = appointments.map((a) => a.id)
    const reports = apptIds.length
      ? await prisma.doctorReport.findMany({
          where: { appointmentId: { in: apptIds } },
          select: { appointmentId: true, documentId: true, createdAt: true }
        })
      : []
    const reportByApptId = new Map(reports.map((r) => [r.appointmentId, { documentId: r.documentId, createdAt: r.createdAt }]))

    // Форматируем данные для ответа
    const formattedAppointments = appointments.map(appointment => ({
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      patientPhone: appointment.patientPhone,
      appointmentType: appointment.appointmentType,
      scheduledAt: appointment.scheduledAt,
      duration: appointment.duration,
      status: appointment.status,
      notes: appointment.notes,
      preVisit: appointment.preVisit ? {
        id: appointment.preVisit.id,
        submittedAt: appointment.preVisit.submittedAt,
        updatedAt: appointment.preVisit.updatedAt
      } : null,
      doctorReport: reportByApptId.get(appointment.id) || null,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt
    }))

    return NextResponse.json({ appointments: formattedAppointments })

  } catch (error) {
    console.error('Error fetching doctor appointments:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      const cookieHeader = request.headers.get('cookie')
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
      if (cookies.token) token = cookies.token
    }

    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    // Проверяем, что пользователь является врачом
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId } })
    if (!doctorProfile) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const body = await request.json()
    const { patientId, scheduledAt, appointmentType = 'consultation', duration = 15, notes } = body || {}

    if (!patientId || !scheduledAt) return NextResponse.json({ error: 'patientId и scheduledAt обязательны' }, { status: 400 })

    const when = new Date(scheduledAt)
    if (Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
    if (when < new Date()) return NextResponse.json({ error: 'Нельзя создать запись в прошлом' }, { status: 400 })
    const hour = when.getHours()
    if (hour < 9 || hour >= 21) return NextResponse.json({ error: 'Рабочее время 09:00–21:00' }, { status: 400 })
    if (when.getMinutes() % 15 !== 0) return NextResponse.json({ error: 'Время должно быть кратно 15 минутам' }, { status: 400 })

    // Проверяем, что пациент существует
    const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, name: true, email: true } })
    if (!patient) return NextResponse.json({ error: 'Пациент не найден' }, { status: 404 })

    // Не занято ли время
    const conflict = await prisma.appointment.findFirst({
      where: {
        doctorId: doctorProfile.id,
        scheduledAt: when,
        status: { in: ['scheduled', 'confirmed'] }
      }
    })
    if (conflict) return NextResponse.json({ error: 'Время занято' }, { status: 400 })

    const appt = await prisma.appointment.create({
      data: {
        doctorId: doctorProfile.id,
        patientId: patient.id,
        patientName: patient.name,
        patientEmail: patient.email || null,
        appointmentType,
        scheduledAt: when,
        duration,
        status: 'scheduled',
        notes: notes || null
      }
    })

    // Авто-напоминания пациенту: до/после приёма (без фоновых задач)
    try {
      const pref = await prisma.reminderPreference.findUnique({ where: { userId: patient.id }, select: { email: true, push: true, sms: true } })
      const channels = [pref?.email ? 'EMAIL' : null, pref?.push ? 'PUSH' : null, pref?.sms ? 'SMS' : null].filter(Boolean)

      const pre48 = new Date(when.getTime() - 48 * 60 * 60 * 1000)
      if (pre48.getTime() > Date.now()) {
        await prisma.reminder.create({
          data: {
            userId: patient.id,
            title: 'Подготовка к приёму: заполните анкету',
            description: `За 24–48 часов до приёма заполните анкету. Откройте: /my-appointments`,
            dueAt: pre48,
            recurrence: 'NONE',
            channels: channels.length ? channels : ['PUSH']
          }
        })
      }

      const pre2 = new Date(when.getTime() - 2 * 60 * 60 * 1000)
      if (pre2.getTime() > Date.now()) {
        await prisma.reminder.create({
          data: {
            userId: patient.id,
            title: 'Приём скоро',
            description: `Через 2 часа приём у врача. Откройте: /my-appointments`,
            dueAt: pre2,
            recurrence: 'NONE',
            channels: channels.length ? channels : ['PUSH']
          }
        })
      }

      const post24 = new Date(when.getTime() + 24 * 60 * 60 * 1000)
      if (post24.getTime() > Date.now()) {
        await prisma.reminder.create({
          data: {
            userId: patient.id,
            title: 'После приёма',
            description: 'Добавьте кратко самочувствие/итоги визита в дневник и проверьте назначения. Откройте: /diary',
            dueAt: post24,
            recurrence: 'NONE',
            channels: channels.length ? channels : ['PUSH']
          }
        })
      }
    } catch (e) {
      console.warn('Failed to create appointment reminders', e)
    }

    return NextResponse.json({ appointment: appt })
  } catch (e) {
    console.error('Error creating doctor appointment:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
