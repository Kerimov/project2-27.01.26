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
      where: { userId: payload.userId, approvalStatus: 'PENDING' },
      include: {
        createdByDoctor: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: [{ approvalRequestedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueAt: t.dueAt,
        recurrence: t.recurrence,
        protocolKey: t.protocolKey,
        approvalRequestedAt: t.approvalRequestedAt,
        doctorName: t.createdByDoctor?.user?.name || null,
      })),
    })
  } catch (e) {
    console.error('[care-plan][approvals][GET] error:', e)
    return NextResponse.json({ error: 'Ошибка получения согласований' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : ''
    const decision = typeof body?.decision === 'string' ? body.decision : ''
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 800) : ''

    if (!taskId) return NextResponse.json({ error: 'taskId обязателен' }, { status: 400 })
    if (decision !== 'approve' && decision !== 'reject') {
      return NextResponse.json({ error: 'decision должен быть approve|reject' }, { status: 400 })
    }

    const task = await prisma.carePlanTask.findFirst({
      where: { id: taskId, userId: payload.userId },
    })
    if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })
    if (task.approvalStatus !== 'PENDING') return NextResponse.json({ error: 'Задача уже обработана' }, { status: 400 })

    if (decision === 'reject' && reason.trim().length < 3) {
      return NextResponse.json({ error: 'Укажите причину отказа (минимум 3 символа)' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (decision === 'approve') {
        // создаём напоминание только если есть dueAt
        let reminderId: string | null = null
        if (task.dueAt) {
          const pref = await tx.reminderPreference.findUnique({
            where: { userId: payload.userId },
            select: { email: true, push: true, sms: true },
          })
          const channels = [
            pref?.email ? 'EMAIL' : null,
            pref?.push ? 'PUSH' : null,
            pref?.sms ? 'SMS' : null,
          ].filter(Boolean)

          const reminder = await tx.reminder.create({
            data: {
              userId: payload.userId,
              title: task.title,
              description: task.description || null,
              dueAt: task.dueAt,
              recurrence: task.recurrence,
              channels: channels.length ? channels : ['PUSH'],
            },
          })
          reminderId = reminder.id
        }

        const t = await tx.carePlanTask.update({
          where: { id: task.id },
          data: {
            approvalStatus: 'APPROVED',
            approvedAt: new Date(),
            rejectedAt: null,
            rejectionReason: null,
            approvalRequestedAt: task.approvalRequestedAt || new Date(),
            reminderId,
          },
        })
        await tx.carePlanCheckIn.create({
          data: { taskId: task.id, type: 'NOTE', reason: 'Пациент согласовал задачу.' },
        })
        return t
      }

      const t = await tx.carePlanTask.update({
        where: { id: task.id },
        data: {
          approvalStatus: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: reason.trim(),
        },
      })
      await tx.carePlanCheckIn.create({
        data: { taskId: task.id, type: 'NOTE', reason: `Пациент отклонил задачу: ${reason.trim()}` },
      })
      return t
    })

    return NextResponse.json({ task: { id: updated.id, approvalStatus: updated.approvalStatus } })
  } catch (e) {
    console.error('[care-plan][approvals][POST] error:', e)
    return NextResponse.json({ error: 'Ошибка согласования' }, { status: 500 })
  }
}


