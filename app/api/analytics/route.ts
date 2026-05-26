import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Использует headers, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Простая защита: требуем Bearer токен
    const auth = request.headers.get('authorization') || ''
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = auth.substring(7)
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [users, documents] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, email: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.document.findMany({
        select: {
          id: true,
          userId: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          uploadDate: true,
          parsed: true
        },
        orderBy: { uploadDate: 'desc' }
      })
    ])

    return NextResponse.json({ users, documents })
  } catch (e) {
    return NextResponse.json({ error: 'Analytics error' }, { status: 500 })
  }
}

