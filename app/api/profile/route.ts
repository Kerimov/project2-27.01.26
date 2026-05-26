import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7)
  const cookieToken = request.cookies.get('token')?.value
  return cookieToken || null
}

function parseJsonArray(input: any): string[] | null | undefined {
  if (input === undefined) return undefined
  if (input === null) return null
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 50)
  if (typeof input === 'string') {
    const arr = input
      .split(/[,\n;]/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50)
    return arr
  }
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const profile = await prisma.patientProfile.findUnique({
      where: { userId: payload.userId }
    })
    return NextResponse.json({ profile })
  } catch (e) {
    console.error('[profile][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения профиля' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const sexRaw = typeof body?.sex === 'string' ? body.sex.toUpperCase() : undefined
    const sex = sexRaw === 'MALE' || sexRaw === 'FEMALE' ? sexRaw : null

    const birthDate = (() => {
      if (!body?.birthDate) return null
      const d = new Date(body.birthDate)
      return Number.isNaN(d.getTime()) ? null : d
    })()

    const heightCm =
      typeof body?.heightCm === 'number' && Number.isFinite(body.heightCm)
        ? Math.max(50, Math.min(260, Math.floor(body.heightCm)))
        : null

    const weightKg =
      typeof body?.weightKg === 'number' && Number.isFinite(body.weightKg)
        ? Math.max(2, Math.min(400, body.weightKg))
        : null

    const conditions = parseJsonArray(body?.conditions)
    const allergies = parseJsonArray(body?.allergies)
    const goals = parseJsonArray(body?.goals)
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 2000) : null

    const profile = await prisma.patientProfile.upsert({
      where: { userId: payload.userId },
      create: {
        userId: payload.userId,
        sex: sex as any,
        birthDate,
        heightCm,
        weightKg,
        conditions: conditions ?? null,
        allergies: allergies ?? null,
        goals: goals ?? null,
        notes
      },
      update: {
        sex: sex as any,
        birthDate,
        heightCm,
        weightKg,
        ...(conditions !== undefined ? { conditions } : {}),
        ...(allergies !== undefined ? { allergies } : {}),
        ...(goals !== undefined ? { goals } : {}),
        notes
      }
    })

    return NextResponse.json({ profile })
  } catch (e) {
    console.error('[profile][PUT] error:', e)
    return NextResponse.json(
      {
        error: 'Ошибка сохранения профиля',
        ...(process.env.NODE_ENV !== 'production'
          ? { details: e instanceof Error ? e.message : String(e) }
          : {})
      },
      { status: 500 }
    )
  }
}


