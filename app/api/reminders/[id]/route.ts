import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { isResolvePatientErr, resolvePatientId } from '@/lib/caretaker-access'

// Использует headers, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/reminders/[id] - получить конкретное напоминание
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const patientIdParam = searchParams.get('patientId')
    const resolved = await resolvePatientId({ payload: decoded, requestedPatientId: patientIdParam, capability: 'reminders_read' })
    if (isResolvePatientErr(resolved)) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const reminder = await prisma.reminder.findFirst({
      where: { 
        id: params.id,
        userId: resolved.patientId 
      },
      include: {
        analysis: true,
        document: true,
        deliveries: true
      }
    })

    if (!reminder) {
      return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
    }

    return NextResponse.json(reminder)
  } catch (error) {
    logger.error('Error fetching reminder:', error)
    return NextResponse.json({ error: 'Ошибка получения напоминания' }, { status: 500 })
  }
}

// PUT /api/reminders/[id] - обновить напоминание
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const body = await request.json()
    const {
      patientId,
      title,
      description,
      dueAt,
      recurrence,
      channels
    } = body

    const resolved = await resolvePatientId({ payload: decoded, requestedPatientId: typeof patientId === 'string' ? patientId : null, capability: 'reminders_write' })
    if (isResolvePatientErr(resolved)) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    // Проверяем, что напоминание принадлежит пользователю
    const existingReminder = await prisma.reminder.findFirst({
      where: { 
        id: params.id,
        userId: resolved.patientId 
      }
    })

    if (!existingReminder) {
      return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (dueAt !== undefined) updateData.dueAt = new Date(dueAt)
    if (recurrence !== undefined) updateData.recurrence = recurrence
    if (channels !== undefined) updateData.channels = channels

    const reminder = await prisma.reminder.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(reminder)
  } catch (error) {
    logger.error('Error updating reminder:', error)
    return NextResponse.json({ error: 'Ошибка обновления напоминания' }, { status: 500 })
  }
}

// DELETE /api/reminders/[id] - удалить напоминание
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const patientIdParam = searchParams.get('patientId')
    const resolved = await resolvePatientId({ payload: decoded, requestedPatientId: patientIdParam, capability: 'reminders_write' })
    if (isResolvePatientErr(resolved)) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    // Проверяем, что напоминание принадлежит пользователю
    const existingReminder = await prisma.reminder.findFirst({
      where: { 
        id: params.id,
        userId: resolved.patientId 
      }
    })

    if (!existingReminder) {
      return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
    }

    await prisma.reminder.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Напоминание удалено' })
  } catch (error) {
    logger.error('Error deleting reminder:', error)
    return NextResponse.json({ error: 'Ошибка удаления напоминания' }, { status: 500 })
  }
}
