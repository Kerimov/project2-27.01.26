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

function defaultPermissions() {
  return {
    diary: { read: true, write: true },
    medications: { read: true, write: true },
    reminders: { read: true, write: true }
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const asCaretaker = await prisma.careRelationship.findMany({
      where: { caretakerId: payload.userId },
      include: { patient: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const asPatient = await prisma.careRelationship.findMany({
      where: { patientId: payload.userId },
      include: { caretaker: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      asCaretaker: asCaretaker.map((x) => ({
        id: x.id,
        patient: x.patient,
        permissions: x.permissions,
        createdAt: x.createdAt
      })),
      asPatient: asPatient.map((x) => ({
        id: x.id,
        caretaker: x.caretaker,
        permissions: x.permissions,
        createdAt: x.createdAt
      }))
    })
  } catch (e) {
    console.error('[caretaker][links][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки связок' }, { status: 500 })
  }
}

// Patient grants access to a caretaker by email
export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const me = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true, email: true } })
    if (!me) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    if (me.role !== 'PATIENT') return NextResponse.json({ error: 'Только пациент может выдавать доступ' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const caretakerEmail = typeof body?.caretakerEmail === 'string' ? body.caretakerEmail.trim().toLowerCase() : ''
    if (!caretakerEmail) return NextResponse.json({ error: 'caretakerEmail обязателен' }, { status: 400 })
    if (caretakerEmail === me.email.toLowerCase()) return NextResponse.json({ error: 'Нельзя выдать доступ самому себе' }, { status: 400 })

    const caretaker = await prisma.user.findUnique({
      where: { email: caretakerEmail },
      select: { id: true, email: true, role: true }
    })
    if (!caretaker) return NextResponse.json({ error: 'Пользователь с таким email не найден' }, { status: 404 })

    // permissions: allow overriding, but keep MVP safe
    const perms = typeof body?.permissions === 'object' && body.permissions ? body.permissions : defaultPermissions()

    const link = await prisma.careRelationship.upsert({
      where: { caretakerId_patientId: { caretakerId: caretaker.id, patientId: me.id } },
      create: {
        caretakerId: caretaker.id,
        patientId: me.id,
        permissions: perms
      },
      update: { permissions: perms }
    })

    // If caretaker account isn't explicitly set, we keep role as-is (MVP).
    // Patient can still grant access; UI will show it to the caretaker via links.

    return NextResponse.json({ link }, { status: 201 })
  } catch (e) {
    console.error('[caretaker][links][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка создания связки' }, { status: 500 })
  }
}


