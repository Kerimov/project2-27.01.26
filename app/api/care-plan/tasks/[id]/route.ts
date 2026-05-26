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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const task = await prisma.carePlanTask.findFirst({ where: { id: params.id, userId: payload.userId } })
    if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action : 'update'
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 800) : null

    // update fields
    const updateData: any = {}
    if (body?.title !== undefined) updateData.title = String(body.title || '').slice(0, 200)
    if (body?.description !== undefined) updateData.description = body.description ? String(body.description).slice(0, 2000) : null
    if (body?.dueAt !== undefined) updateData.dueAt = body.dueAt ? new Date(body.dueAt) : null

    if (action === 'complete') {
      updateData.status = 'COMPLETED'
      updateData.snoozedUntil = null
    } else if (action === 'reopen') {
      updateData.status = 'ACTIVE'
      updateData.snoozedUntil = null
    } else if (action === 'snooze') {
      updateData.status = 'SNOOZED'
      updateData.snoozedUntil = body?.snoozedUntil ? new Date(body.snoozedUntil) : (task.dueAt ? new Date(task.dueAt) : null)
      // MVP requirement: чек-ин "почему не сделано"
      if (!reason || reason.trim().length < 3) {
        return NextResponse.json({ error: 'Укажите причину (минимум 3 символа)' }, { status: 400 })
      }
    } else if (body?.status !== undefined) {
      const st = normalizeStatus(body.status)
      if (!st) return NextResponse.json({ error: 'Неверный статус' }, { status: 400 })
      updateData.status = st
      if (st !== 'SNOOZED') updateData.snoozedUntil = null
    }

    const updated = await prisma.carePlanTask.update({
      where: { id: task.id },
      data: updateData
    })

    // create check-in record for actions
    if (action === 'complete' || action === 'reopen' || action === 'snooze' || action === 'note') {
      const type =
        action === 'complete' ? 'COMPLETE' :
        action === 'reopen' ? 'REOPEN' :
        action === 'snooze' ? 'SNOOZE' : 'NOTE'
      await prisma.carePlanCheckIn.create({
        data: {
          taskId: task.id,
          type,
          reason: reason && reason.trim().length > 0 ? reason.trim() : null
        }
      })
    }

    return NextResponse.json({ task: updated })
  } catch (e) {
    console.error('[care-plan][PATCH] error:', e)
    return NextResponse.json({ error: 'Ошибка обновления задачи' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const task = await prisma.carePlanTask.findFirst({ where: { id: params.id, userId: payload.userId } })
    if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })

    await prisma.carePlanTask.delete({ where: { id: task.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[care-plan][DELETE] error:', e)
    return NextResponse.json({ error: 'Ошибка удаления задачи' }, { status: 500 })
  }
}


