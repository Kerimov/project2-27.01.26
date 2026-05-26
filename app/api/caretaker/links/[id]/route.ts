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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const link = await prisma.careRelationship.findUnique({ where: { id: params.id } })
    if (!link) return NextResponse.json({ error: 'Связка не найдена' }, { status: 404 })

    // allow patient or caretaker to remove
    if (link.patientId !== payload.userId && link.caretakerId !== payload.userId) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    await prisma.careRelationship.delete({ where: { id: link.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[caretaker][links][DELETE] error:', e)
    return NextResponse.json({ error: 'Ошибка удаления связки' }, { status: 500 })
  }
}


