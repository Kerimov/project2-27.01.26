import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
// Маршрут использует request.headers (cookie), поэтому его нужно пометить как динамический,
// чтобы Next.js не пытался выполнять его при статическом экспорте.
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Неверный токен' },
        { status: 401 }
      )
    }

    const documents = await prisma.document.findMany({
      where: { userId: payload.userId },
      orderBy: { uploadDate: 'desc' }
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Get documents error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const isDb =
      /database|datasource|connection|prisma|p1000|p1001|p1002|p1011|p1012|p2021|sqlite|postgres|timeout/i.test(msg)
    const hint = isDb ? 'Проблема соединения с базой данных на сервере.' : null
    return NextResponse.json(
      { error: 'Ошибка получения документов', hint },
      { status: 500 }
    )
  }
}

