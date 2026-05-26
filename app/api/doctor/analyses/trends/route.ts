import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

// Использует request.url и заголовки, поэтому помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId') || ''
    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })

    // auth: bearer or cookie
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7)
    else {
      const cookieHeader = request.headers.get('cookie')
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
      if (cookies.token) token = cookies.token
    }
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    // ensure doctor
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    // allow access only if patient is attached or has appointment
    const [hasRecord, hasAppointment] = await Promise.all([
      prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } }),
    ])
    if (!hasRecord && !hasAppointment) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    const analyses = await prisma.analysis.findMany({
      where: { userId: patientId },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, results: true, title: true, type: true }
    })

    type SeriesPoint = { date: string; value: number; referenceMin?: number | null; referenceMax?: number | null; isNormal?: boolean | null }

    const byIndicator: Record<string, SeriesPoint[]> = {}
    for (const a of analyses) {
      const dateIso = (a.date as unknown as Date).toISOString()
      let indicators: any[] = []
      try {
        const r = a?.results ? JSON.parse(a.results as unknown as string) : {}
        if (Array.isArray(r?.indicators)) indicators = r.indicators
      } catch {}
      for (const ind of indicators) {
        const name: string = ind?.name || 'Показатель'
        const value = typeof ind?.value === 'number' ? ind.value : Number(ind?.value)
        if (Number.isNaN(value)) continue
        const item: SeriesPoint = {
          date: dateIso,
          value,
          referenceMin: typeof ind?.referenceMin === 'number' ? ind.referenceMin : (ind?.referenceMin ? Number(ind.referenceMin) : null),
          referenceMax: typeof ind?.referenceMax === 'number' ? ind.referenceMax : (ind?.referenceMax ? Number(ind.referenceMax) : null),
          isNormal: typeof ind?.isNormal === 'boolean' ? ind.isNormal : null,
        }
        if (!byIndicator[name]) byIndicator[name] = []
        byIndicator[name].push(item)
      }
    }

    // sort by date per series
    Object.values(byIndicator).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)))

    return NextResponse.json({ indicators: byIndicator })
  } catch (e: any) {
    console.error('Trends API error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', details: e?.message || String(e) }, { status: 500 })
  }
}


