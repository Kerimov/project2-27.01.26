import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parse as parseCookies } from 'cookie'

// Использует request.headers и request.url, поэтому маршрут должен быть динамическим
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date')

    if (!doctorId || !date) {
      return NextResponse.json(
        { error: 'ID врача и дата обязательны' },
        { status: 400 }
      )
    }

    // Проверяем, что врач существует
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!doctor) {
      return NextResponse.json(
        { error: 'Врач не найден' },
        { status: 404 }
      )
    }

    const selectedDate = new Date(date)
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(9, 0, 0, 0) // 9:00
    
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(21, 0, 0, 0) // 21:00

    // Получаем занятые временные слоты
    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: {
          gte: startOfDay,
          lt: endOfDay
        },
        status: {
          in: ['scheduled', 'confirmed']
        }
      },
      select: {
        scheduledAt: true
      }
    })

    // Создаем массив всех возможных слотов (каждые 15 минут)
    const availableSlots = []
    const currentTime = new Date(startOfDay)
    
    while (currentTime < endOfDay) {
      // Проверяем, что время не в прошлом (если это сегодня)
      const now = new Date()
      if (currentTime > now) {
        // Проверяем, не занят ли этот слот
        const isBooked = bookedAppointments.some(appointment => {
          const appointmentTime = new Date(appointment.scheduledAt)
          return appointmentTime.getTime() === currentTime.getTime()
        })

        if (!isBooked) {
          availableSlots.push({
            time: currentTime.toISOString(),
            timeString: currentTime.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            available: true
          })
        } else {
          availableSlots.push({
            time: currentTime.toISOString(),
            timeString: currentTime.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            available: false
          })
        }
      }

      // Добавляем 15 минут
      currentTime.setMinutes(currentTime.getMinutes() + 15)
    }

    return NextResponse.json({
      doctor: {
        id: doctor.id,
        name: doctor.user.name,
        email: doctor.user.email,
        specialization: doctor.specialization
      },
      date: selectedDate.toISOString(),
      availableSlots
    })

  } catch (error) {
    console.error('Error fetching available slots:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
