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

function normalizeStatus(s: any): 'ACTIVE' | 'SNOOZED' | 'COMPLETED' | null {
  const v = String(s || '').toUpperCase()
  if (v === 'ACTIVE' || v === 'SNOOZED' || v === 'COMPLETED') return v
  return null
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = normalizeStatus(searchParams.get('status'))
    const includePending = searchParams.get('includePending') === 'true'

    const tasks = await prisma.carePlanTask.findMany({
      where: {
        userId: payload.userId,
        ...(!includePending ? { approvalStatus: 'APPROVED' } : {}),
        ...(status ? { status } : {})
      },
      include: {
        analysis: { select: { id: true, title: true, date: true, status: true } },
        document: { select: { id: true, fileName: true } },
        checkIns: { orderBy: { createdAt: 'desc' }, take: 3 }
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }]
    })

    return NextResponse.json({ tasks })
  } catch (e) {
    console.error('[care-plan][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения задач' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'title обязателен' }, { status: 400 })

    const created = await prisma.carePlanTask.create({
      data: {
        userId: payload.userId,
        title,
        description: typeof body?.description === 'string' ? body.description : null,
        dueAt: body?.dueAt ? new Date(body.dueAt) : null,
        recurrence: typeof body?.recurrence === 'string' ? body.recurrence : 'NONE',
        channels: Array.isArray(body?.channels) ? body.channels : null,
        analysisId: typeof body?.analysisId === 'string' ? body.analysisId : null,
        documentId: typeof body?.documentId === 'string' ? body.documentId : null
      }
    })

    return NextResponse.json({ task: created }, { status: 201 })
  } catch (e) {
    console.error('[care-plan][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка создания задачи' }, { status: 500 })
  }
}


