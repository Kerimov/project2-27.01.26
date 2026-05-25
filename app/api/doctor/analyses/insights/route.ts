import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'
import { getAIConfig } from '@/lib/ai-medical-parser'
import { callOllamaChat } from '@/lib/ollama'

// Использует request.url и заголовки/cookie, поэтому помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId') || ''
    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })

    // auth
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

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const [hasRecord, hasAppointment] = await Promise.all([
      prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } }),
    ])
    if (!hasRecord && !hasAppointment) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    // collect last 12 months analyses
    const analyses = await prisma.analysis.findMany({
      where: { userId: patientId },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, title: true, results: true }
    })

    const summaryInput = analyses.slice(-40).map(a => {
      const date = (a.date as unknown as Date).toISOString().slice(0,10)
      let indicators: any[] = []
      try {
        const r = a?.results ? JSON.parse(a.results as unknown as string) : {}
        if (Array.isArray(r?.indicators)) indicators = r.indicators
      } catch {}
      const lines = indicators
        .filter(i => typeof i?.value !== 'undefined')
        .map(i => `${i.name}: ${i.value}${i.unit ? ' ' + i.unit : ''} [${i.referenceMin ?? ''}-${i.referenceMax ?? ''}] ${i.isNormal === false ? '(abn)' : ''}`)
        .join('; ')
      return `${date} — ${a.title || 'Анализ'}: ${lines}`
    }).join('\n')

    const ai = getAIConfig()
    let insights = ''
    if (ai?.provider === 'ollama') {
      try {
        insights = await callOllamaChat({
          system:
            'Ты медицинский ассистент. Суммаризируй динамику показателей анализов. Коротко, по-русски. Выдели ухудшения/улучшения, перечисли риски и рекомендации. Структура: Итог, Улучшения, Ухудшения, Риски, Рекомендации.',
          user: `Данные анализов по датам:\n${summaryInput}`,
          temperature: 0,
          model: ai.model,
        })
      } catch {
        insights = ''
      }
    }

    if (!insights) {
      // simple fallback: count abnormal per indicator
      const counts: Record<string, { abn: number; total: number }> = {}
      for (const a of analyses) {
        let inds: any[] = []
        try {
          const r = a?.results ? JSON.parse(a.results as unknown as string) : {}
          if (Array.isArray(r?.indicators)) inds = r.indicators
        } catch {}
        for (const i of inds) {
          const key = i?.name || 'Показатель'
          if (!counts[key]) counts[key] = { abn: 0, total: 0 }
          counts[key].total++
          if (i?.isNormal === false) counts[key].abn++
        }
      }
      const worst = Object.entries(counts).filter(([, v]) => v.total > 0).sort((a, b) => (b[1].abn / b[1].total) - (a[1].abn / a[1].total)).slice(0, 5)
      insights = worst.length
        ? `Наибольшее число отклонений: ${worst.map(([k, v]) => `${k} (${v.abn}/${v.total})`).join(', ')}.`
        : 'Существенных отклонений по динамике не выявлено.'
    }

    return NextResponse.json({ insights })
  } catch (e: any) {
    console.error('Insights API error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', details: e?.message || String(e) }, { status: 500 })
  }
}


