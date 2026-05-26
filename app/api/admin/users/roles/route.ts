import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Использует request.cookies, поэтому маршрут должен быть динамическим
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

    // Проверяем, что пользователь является админом
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Получаем всех пользователей с их ролями
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        doctorProfile: {
          select: {
            specialization: true,
            isVerified: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(users)

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении пользователей' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    // Проверяем, что пользователь является админом
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json({ error: 'Не указан ID пользователя или роль' }, { status: 400 })
    }

    if (!['PATIENT', 'DOCTOR', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 })
    }

    // Проверяем, что пользователь не пытается изменить свою роль
    if (userId === decoded.userId) {
      return NextResponse.json({ error: 'Нельзя изменить свою роль' }, { status: 400 })
    }

    // Обновляем роль пользователя
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        doctorProfile: {
          select: {
            specialization: true,
            isVerified: true
          }
        }
      }
    })

    return NextResponse.json(updatedUser)

  } catch (error) {
    console.error('Error updating user role:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении роли пользователя' },
      { status: 500 }
    )
  }
}
