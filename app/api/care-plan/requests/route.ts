import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
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
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const tasks = await prisma.carePlanTask.findMany({
      where: {
        userId: payload.userId,
        kind: 'REQUEST',
        approvalStatus: 'APPROVED',
        status: { not: 'COMPLETED' }
      },
      include: {
        createdByDoctor: { select: { id: true, user: { select: { name: true } } } }
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }]
    })

    return NextResponse.json({
      requests: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueAt: t.dueAt,
        requestType: t.requestType,
        meta: t.meta,
        doctorName: t.createdByDoctor?.user?.name || null
      }))
    })
  } catch (e) {
    console.error('[care-plan][requests][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения запросов' }, { status: 500 })
  }
}


