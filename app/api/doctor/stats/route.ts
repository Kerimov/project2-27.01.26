import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Использует request.cookies, поэтому помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Проверяем токен
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является врачом
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      include: {
        patientRecords: {
          include: {
            patient: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 5
        },
        appointments: {
          where: {
            scheduledAt: {
              gte: new Date()
            }
          },
          orderBy: { scheduledAt: 'asc' },
          take: 5
        },
        medicalNotes: {
          where: {
            priority: 'urgent'
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        prescriptions: {
          where: {
            isActive: true
          }
        }
      }
    })

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 404 })
    }

    // Получаем статистику
    const totalPatients = await prisma.patientRecord.count({
      where: { doctorId: doctorProfile.id }
    })

    const activePatients = await prisma.patientRecord.count({
      where: { 
        doctorId: doctorProfile.id,
        status: 'active'
      }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId: doctorProfile.id,
        scheduledAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const pendingAppointments = await prisma.appointment.count({
      where: {
        doctorId: doctorProfile.id,
        status: 'scheduled'
      }
    })

    const totalPrescriptions = await prisma.prescription.count({
      where: { doctorId: doctorProfile.id }
    })

    const activePrescriptions = await prisma.prescription.count({
      where: { 
        doctorId: doctorProfile.id,
        isActive: true
      }
    })

    // Форматируем данные для ответа
    const recentPatients = doctorProfile.patientRecords.map(record => ({
      id: record.id,
      name: record.patient.name,
      recordType: record.recordType,
      status: record.status,
      updatedAt: record.updatedAt
    }))

    const upcomingAppointments = doctorProfile.appointments.map(appointment => ({
      id: appointment.id,
      patientName: appointment.patientName,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
      appointmentType: appointment.appointmentType
    }))

    const urgentNotes = doctorProfile.medicalNotes.map(note => ({
      id: note.id,
      title: note.title,
      priority: note.priority,
      createdAt: note.createdAt
    }))

    const stats = {
      totalPatients,
      activePatients,
      todayAppointments,
      pendingAppointments,
      totalPrescriptions,
      activePrescriptions,
      recentPatients,
      upcomingAppointments,
      urgentNotes
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching doctor stats:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении статистики' },
      { status: 500 }
    )
  }
}
