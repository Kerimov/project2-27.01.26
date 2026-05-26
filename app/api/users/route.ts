import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Этот маршрут использует cookies, поэтому явно помечаем его как динамический
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

    // Получаем всех пользователей (только базовую информацию)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
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
