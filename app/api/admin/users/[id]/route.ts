import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// Использует headers, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Проверяем токен
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является админом
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    })

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Получаем пользователя по ID
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            documents: true,
            analyses: true,
            reminders: true,
            recommendations: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    return NextResponse.json({
      ...user,
      documentsCount: user._count.documents,
      analysesCount: user._count.analyses,
      remindersCount: user._count.reminders,
      recommendationsCount: user._count.recommendations
    })

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении пользователя' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Проверяем токен
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является админом
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    })

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, role, password } = body

    // Проверяем, что пользователь существует
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Проверяем, что админ не пытается изменить свою роль
    if (params.id === decoded.userId && role && role !== existingUser.role) {
      return NextResponse.json({ error: 'Нельзя изменить свою роль' }, { status: 400 })
    }

    // Проверяем уникальность email (если изменяется)
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      })

      if (emailExists) {
        return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 })
      }
    }

    // Подготавливаем данные для обновления
    const updateData: any = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (role) updateData.role = role
    if (password) updateData.password = await bcrypt.hash(password, 10)

    // Обновляем пользователя
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            documents: true,
            analyses: true,
            reminders: true,
            recommendations: true
          }
        }
      }
    })

    return NextResponse.json({
      ...updatedUser,
      documentsCount: updatedUser._count.documents,
      analysesCount: updatedUser._count.analyses,
      remindersCount: updatedUser._count.reminders,
      recommendationsCount: updatedUser._count.recommendations
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении пользователя' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Проверяем токен
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является админом
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    })

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Проверяем, что админ не пытается удалить себя
    if (params.id === decoded.userId) {
      return NextResponse.json({ error: 'Нельзя удалить свою учетную запись' }, { status: 400 })
    }

    // Проверяем, что пользователь существует
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Удаляем пользователя (каскадное удаление настроено в схеме)
    await prisma.user.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Пользователь успешно удален' })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении пользователя' },
      { status: 500 }
    )
  }
}