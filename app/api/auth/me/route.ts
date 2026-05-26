import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'
// Использует request.headers и cookies, поэтому маршрут должен быть динамическим
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 1) Пробуем получить токен из заголовка Authorization
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    // 2) Если заголовка нет — пробуем cookie `token` (работает с httpOnly)
    if (!token) {
      const cookieToken = request.cookies.get('token')?.value
      if (cookieToken) token = cookieToken
    }

    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const payload = verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: 'Неверный токен' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({ 
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Ошибка проверки авторизации' },
      { status: 500 }
    )
  }
}

