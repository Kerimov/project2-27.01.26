import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      select: { id: true }
    })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const existing = await prisma.prescription.findUnique({
      where: { id: params.id },
    })
    if (!existing) return NextResponse.json({ error: 'Рецепт не найден' }, { status: 404 })
    if (existing.doctorId !== doctor.id) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action : 'update'

    const data: any = {}
    if (body?.medication !== undefined) data.medication = String(body.medication || '').slice(0, 200)
    if (body?.dosage !== undefined) data.dosage = String(body.dosage || '').slice(0, 200)
    if (body?.frequency !== undefined) data.frequency = String(body.frequency || '').slice(0, 200)
    if (body?.duration !== undefined) data.duration = String(body.duration || '').slice(0, 200)
    if (body?.instructions !== undefined) data.instructions = body.instructions ? String(body.instructions).slice(0, 2000) : null
    if (body?.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

    if (action === 'close') {
      data.isActive = false
    } else if (action === 'reopen') {
      data.isActive = true
    } else if (action === 'extend') {
      data.isActive = true
      if (body?.expiresAt) data.expiresAt = new Date(body.expiresAt)
    }

    const updated = await prisma.prescription.update({
      where: { id: existing.id },
      data
    })

    return NextResponse.json({ prescription: updated })
  } catch (e) {
    console.error('Error updating doctor prescription:', e)
    return NextResponse.json({ error: 'Ошибка обновления рецепта' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      select: { id: true }
    })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const existing = await prisma.prescription.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Рецепт не найден' }, { status: 404 })
    if (existing.doctorId !== doctor.id) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

    await prisma.prescription.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error deleting doctor prescription:', e)
    return NextResponse.json({ error: 'Ошибка удаления рецепта' }, { status: 500 })
  }
}


