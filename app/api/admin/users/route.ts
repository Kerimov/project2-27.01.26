import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Использует headers/cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем права администратора
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Получаем всех пользователей с их статистикой
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
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

    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      documentsCount: user._count.documents,
      analysesCount: user._count.analyses,
      remindersCount: user._count.reminders,
      recommendationsCount: user._count.recommendations
    }))

    return NextResponse.json({ users: formattedUsers })

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем права администратора
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    })

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    // Получаем данные из запроса
    const body = await request.json()
    const { name, email, password, role } = body

    // Валидация
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Все поля обязательны для заполнения' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен содержать минимум 6 символов' },
        { status: 400 }
      )
    }

    if (!['PATIENT', 'DOCTOR', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Неверная роль пользователя' },
        { status: 400 }
      )
    }

    // Проверяем, что пользователь с таким email не существует
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      )
    }

    // Хешируем пароль
    const hashedPassword = await hashPassword(password)

    // Создаем пользователя
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      },
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

    console.log('User created by admin:', email, 'Role:', role)

    return NextResponse.json({
      message: 'Пользователь успешно создан',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
        documentsCount: newUser._count.documents,
        analysesCount: newUser._count.analyses,
        remindersCount: newUser._count.reminders,
        recommendationsCount: newUser._count.recommendations
      }
    })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
