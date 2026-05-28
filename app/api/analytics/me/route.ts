import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { ACTIVE_APPOINTMENT_STATUSES } from '@/lib/appointments-filter'
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

  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 90)

  const [entries, documentsCount, analysesCount, appts] = await Promise.all([
    prisma.healthDiaryEntry.findMany({
      where: { userId: user.userId, entryDate: { gte: from, lte: to } },
      orderBy: { entryDate: 'asc' }
    }),
    prisma.document.count({ where: { userId: user.userId } }),
    prisma.analysis.count({ where: { userId: user.userId } }),
    prisma.appointment.findMany({
      where: {
        patientId: user.userId,
        scheduledAt: { gte: new Date() },
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      },
      orderBy: { scheduledAt: 'asc' },
    }),
  ])

  // Группируем по дню
  const byDay: Record<string, any[]> = {}
  for (const e of entries) {
    const d = new Date(e.entryDate)
    const key = d.toISOString().slice(0,10)
    ;(byDay[key] ||= []).push(e)
  }

  const days = Object.keys(byDay).sort()
  const trend = days.map((day) => {
    const list = byDay[day]
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null)
    return {
      day,
      mood: avg(list.map(e => e.mood ?? 0).filter(n => n>0)),
      pain: avg(list.map(e => e.painScore ?? 0)),
      sleep: avg(list.map(e => e.sleepHours ?? 0)),
      steps: avg(list.map(e => e.steps ?? 0)),
      systolic: avg(list.map(e => e.systolic ?? 0).filter(n => n>0)),
      diastolic: avg(list.map(e => e.diastolic ?? 0).filter(n => n>0)),
      pulse: avg(list.map(e => e.pulse ?? 0).filter(n => n>0))
    }
  })

  const kpi = {
    documentsCount,
    analysesCount,
    upcomingAppointments: appts.length,
    avgSleep: Number((trend.map(t=>t.sleep ?? 0).filter(n=>n>0).reduce((a,b)=>a+b,0) / Math.max(1, trend.filter(t=>t.sleep).length)).toFixed(1)),
    avgMood: Number((trend.map(t=>t.mood ?? 0).filter(n=>n>0).reduce((a,b)=>a+b,0) / Math.max(1, trend.filter(t=>t.mood).length)).toFixed(1)),
    avgSteps: Math.round(trend.map(t=>t.steps ?? 0).filter(n=>n>0).reduce((a,b)=>a+b,0) / Math.max(1, trend.filter(t=>t.steps).length))
  }

  return NextResponse.json({ from, to, kpi, trend })
}


