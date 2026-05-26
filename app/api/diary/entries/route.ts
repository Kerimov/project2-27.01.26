import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { isResolvePatientErr, resolvePatientId } from '@/lib/caretaker-access'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'

function getToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = req.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientIdParam = searchParams.get('patientId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const tag = searchParams.get('tag')
  const order = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

  const resolved = await resolvePatientId({ payload: user, requestedPatientId: patientIdParam, capability: 'diary_read' })
  if (isResolvePatientErr(resolved)) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const where: any = { userId: resolved.patientId }
  if (from || to) where.entryDate = {
    gte: from ? new Date(from) : undefined,
    lte: to ? new Date(to) : undefined
  }
  if (tag) where.tags = { some: { tag: { name: tag } } }

  const entries = await prisma.healthDiaryEntry.findMany({
    where,
    include: { tags: { include: { tag: true } } },
    orderBy: { entryDate: order }
  })
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { patientId, entryDate, mood, painScore, sleepHours, steps, temperature, weight, systolic, diastolic, pulse, symptoms, notes, tags } = body

  const resolved = await resolvePatientId({ payload: user, requestedPatientId: typeof patientId === 'string' ? patientId : null, capability: 'diary_write' })
  if (isResolvePatientErr(resolved)) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const entry = await prisma.healthDiaryEntry.create({
    data: {
      userId: resolved.patientId,
      entryDate: entryDate ? new Date(entryDate) : new Date(),
      mood, painScore, sleepHours, steps, temperature, weight, systolic, diastolic, pulse, symptoms, notes,
      tags: tags?.length ? {
        create: tags.map((name: string) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId: resolved.patientId, name } },
              create: { userId: resolved.patientId, name }
            }
          }
        }))
      } : undefined
    },
    include: { tags: { include: { tag: true } } }
  })
  return NextResponse.json(entry, { status: 201 })
}

