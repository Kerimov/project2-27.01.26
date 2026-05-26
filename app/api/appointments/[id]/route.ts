import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export const runtime = 'nodejs'
// Использует headers/cookies, помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const appointmentId = params.id
    const body = await request.json()
    const { status, scheduledAt } = body

    // Получаем токен из заголовка или cookies
    let token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      const cookies = request.headers.get('cookie')
      if (cookies) {
        const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('token='))
        if (tokenCookie) {
          token = tokenCookie.split('=')[1]
        }
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    const userId = decoded.userId

    // Проверяем, что пользователь является пациентом
    if (decoded.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Находим запись
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: { include: { user: true } } }
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    }

    // Проверяем, что запись принадлежит текущему пациенту
    if (appointment.patientId !== userId) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Валидация для переноса
    if (status === 'scheduled' && scheduledAt) {
      const newDate = new Date(scheduledAt)
      const now = new Date()

      // Проверяем, что новая дата в будущем
      if (newDate <= now) {
        return NextResponse.json({ error: 'Новая дата должна быть в будущем' }, { status: 400 })
      }

      // Проверяем рабочее время (9:00-21:00)
      const hour = newDate.getHours()
      if (hour < 9 || hour >= 21) {
        return NextResponse.json({ error: 'Рабочее время с 9:00 до 21:00' }, { status: 400 })
      }

      // Проверяем 15-минутные интервалы
      const minutes = newDate.getMinutes()
      if (minutes % 15 !== 0) {
        return NextResponse.json({ error: 'Время должно быть кратно 15 минутам' }, { status: 400 })
      }

      // Проверяем доступность слота
      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          scheduledAt: newDate,
          status: { not: 'cancelled' },
          id: { not: appointmentId }
        }
      })

      if (existingAppointment) {
        return NextResponse.json({ error: 'Этот слот уже занят' }, { status: 400 })
      }
    }

    // Обновляем запись
    const updateData: any = { status }
    if (status === 'scheduled' && scheduledAt) {
      updateData.scheduledAt = new Date(scheduledAt)
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData
    })

    // Создаем запись в истории пациента (если есть модель PatientNote)
    try {
      const noteText = status === 'cancelled' 
        ? `Пациент отменил запись на ${new Date(appointment.scheduledAt).toLocaleDateString('ru-RU')} в ${new Date(appointment.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        : `Пациент перенес запись с ${new Date(appointment.scheduledAt).toLocaleDateString('ru-RU')} в ${new Date(appointment.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} на ${new Date(scheduledAt).toLocaleDateString('ru-RU')} в ${new Date(scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`

      // Проверяем, существует ли модель PatientNote
      const patientRecord = await prisma.patientRecord.findFirst({
        where: { patientId: userId }
      })

      if (patientRecord) {
        // Если есть запись пациента, можем добавить заметку (если модель поддерживает)
        console.log(`Patient note: ${noteText}`)
      }
    } catch (error) {
      console.log('Patient note creation skipped:', error)
    }

    return NextResponse.json({ 
      success: true, 
      appointment: updatedAppointment 
    })

  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении записи' },
      { status: 500 }
    )
  }
}
