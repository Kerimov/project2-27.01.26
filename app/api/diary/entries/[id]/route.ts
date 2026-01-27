import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { isResolvePatientErr, resolvePatientId } from '@/lib/caretaker-access'
import { parse as parseCookies } from 'cookie'

function getToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = req.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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

  const existing = await prisma.healthDiaryEntry.findUnique({ where: { id: params.id }, select: { id: true, userId: true } })
  if (!existing || existing.userId !== resolved.patientId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.healthDiaryEntry.update({
    where: { id: params.id },
    data: {
      entryDate: entryDate ? new Date(entryDate) : undefined,
      mood, painScore, sleepHours, steps, temperature, weight, systolic, diastolic, pulse, symptoms, notes,
      ...(tags ? { tags: {
        deleteMany: {},
        create: tags.map((name: string) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId: resolved.patientId, name } },
              create: { userId: resolved.patientId, name }
            }
          }
        }))
      } } : {})
    },
    include: { tags: { include: { tag: true } } }
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientIdParam = searchParams.get('patientId')
  const resolved = await resolvePatientId({ payload: user, requestedPatientId: patientIdParam, capability: 'diary_write' })
  if (isResolvePatientErr(resolved)) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const existing = await prisma.healthDiaryEntry.findUnique({ where: { id: params.id }, select: { id: true, userId: true } })
  if (!existing || existing.userId !== resolved.patientId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.healthDiaryEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

