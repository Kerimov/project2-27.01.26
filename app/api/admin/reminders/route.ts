import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Использует cookies/headers, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!user || !adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Получаем все напоминания с пользователями и анализами
    const reminders = await prisma.reminder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        analysis: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    // Парсим channels из JSON строки
    const formattedReminders = reminders.map(reminder => ({
      ...reminder,
      channels: typeof reminder.channels === 'string' 
        ? JSON.parse(reminder.channels) 
        : reminder.channels
    }))

    return NextResponse.json({ reminders: formattedReminders })

  } catch (error) {
    console.error('Error fetching reminders:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
