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

    // Получаем статистику
    const [
      totalUsers,
      totalDocuments,
      totalAnalyses,
      totalReminders,
      totalRecommendations,
      totalCompanies,
      recentUsers,
      recentDocuments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.document.count(),
      prisma.analysis.count(),
      prisma.reminder.count(),
      prisma.recommendation.count(),
      prisma.company.count(),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true
        }
      }),
      prisma.document.findMany({
        take: 5,
        orderBy: { uploadDate: 'desc' },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          uploadDate: true
        }
      })
    ])

    return NextResponse.json({
      totalUsers,
      totalDocuments,
      totalAnalyses,
      totalReminders,
      totalRecommendations,
      totalCompanies,
      recentUsers,
      recentDocuments
    })

  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
