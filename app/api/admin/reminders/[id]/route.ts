import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Использует cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверяем авторизацию
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем права администратора
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'test@pma.ru,admin@example.com').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!adminUser || !adminEmails.includes(adminUser.email.toLowerCase())) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const reminderId = params.id

    // Проверяем, что напоминание существует
    const reminderToDelete = await prisma.reminder.findUnique({
      where: { id: reminderId }
    })

    if (!reminderToDelete) {
      return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
    }

    // Удаляем напоминание
    await prisma.reminder.delete({
      where: { id: reminderId }
    })

    return NextResponse.json({ message: 'Напоминание успешно удалено' })

  } catch (error) {
    console.error('Error deleting reminder:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверяем авторизацию
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем права администратора
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'test@pma.ru,admin@example.com').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!adminUser || !adminEmails.includes(adminUser.email.toLowerCase())) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const reminderId = params.id
    const body = await request.json()
    const { title, description, dueAt } = body

    // Проверяем, что напоминание существует
    const reminderToUpdate = await prisma.reminder.findUnique({
      where: { id: reminderId }
    })

    if (!reminderToUpdate) {
      return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
    }

    // Обновляем напоминание
    const updatedReminder = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        title: title || reminderToUpdate.title,
        description: description || reminderToUpdate.description,
        dueAt: dueAt || reminderToUpdate.dueAt
      }
    })

    return NextResponse.json({ 
      message: 'Напоминание успешно обновлено',
      reminder: updatedReminder
    })

  } catch (error) {
    console.error('Error updating reminder:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
