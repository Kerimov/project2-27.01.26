import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'
import { getAIConfig } from '@/lib/ai-medical-parser'
import { callOllamaChat } from '@/lib/ollama'

// Использует headers/cookies, помечаем маршрут как динамический
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json().catch(() => ({})) as { analysisIds?: string[]; patientId?: string }
    const analysisIds = Array.isArray(body.analysisIds) ? body.analysisIds.filter(Boolean) : []
    const patientId = body.patientId || ''
    if (!patientId || analysisIds.length < 2) {
      return NextResponse.json({ error: 'Нужно минимум два анализа и patientId' }, { status: 400 })
    }

    // ensure doctor and access to patient
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: decoded.userId } })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })
    const [hasRecord, hasAppointment] = await Promise.all([
      prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } })
    ])
    if (!hasRecord && !hasAppointment) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    const analyses = await prisma.analysis.findMany({
      where: { id: { in: analysisIds }, userId: patientId },
      select: { id: true, date: true, title: true, results: true },
      orderBy: { date: 'asc' }
    })

    // Build comparison by indicator name
    type Point = { analysisId: string; date: string; value: number; unit?: string | null }
    const byIndicator: Record<string, Point[]> = {}
    for (const a of analyses) {
      const dateIso = (a.date as unknown as Date).toISOString()
      let inds: any[] = []
      try {
        const r = a?.results ? JSON.parse(a.results as unknown as string) : {}
        if (Array.isArray(r?.indicators)) inds = r.indicators
      } catch {}
      for (const ind of inds) {
        const name = (ind?.name || '').toString().trim()
        const valNum = typeof ind?.value === 'number' ? ind.value : Number(ind?.value)
        if (!name || Number.isNaN(valNum)) continue
        if (!byIndicator[name]) byIndicator[name] = []
        byIndicator[name].push({ analysisId: a.id, date: dateIso, value: valNum, unit: ind?.unit || null })
      }
    }
    Object.values(byIndicator).forEach(arr => arr.sort((a,b)=>a.date.localeCompare(b.date)))

    // AI summary
    const ai = await getAIConfig()
    let insights = ''
    if (ai?.provider === 'ollama') {
      try {
        const lines: string[] = []
        for (const [name, series] of Object.entries(byIndicator)) {
          const s = series.map(p => `${p.date.slice(0,10)}=${p.value}${p.unit?(' '+p.unit):''}`).join(', ')
          lines.push(`${name}: ${s}`)
        }
        const prompt = `Сравни динамику показателей по нескольким анализам пациента. Отметь улучшения/ухудшения и дай краткие рекомендации.\n${lines.join('\n')}`
        insights = await callOllamaChat({
          system: 'Кратко, по-русски. Формат: Итог, Улучшения, Ухудшения, Риски, Рекомендации.',
          user: prompt,
          temperature: 0,
          model: ai.model,
        })
      } catch {}
    }

    return NextResponse.json({ indicators: byIndicator, insights, analyses: analyses.map(a=>({ id: a.id, date: a.date, title: a.title })) })
  } catch (e: any) {
    console.error('Compare API error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', details: e?.message || String(e) }, { status: 500 })
  }
}


