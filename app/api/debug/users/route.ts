import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// Отладочный эндпоинт (удалить в продакшене!)
export async function GET() {
  // Проверяем наличие DATABASE_URL
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      error: 'DATABASE_URL not configured',
      totalUsers: 0,
      users: []
    })
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })
    
    return NextResponse.json({
      totalUsers: users.length,
      users: users
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Database connection failed',
      totalUsers: 0,
      users: []
    })
  }
}

