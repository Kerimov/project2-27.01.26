import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const dynamic = 'force-dynamic'

type IndicatorPatch = {
  name: string
  value?: string | number | null
  unit?: string | null
  referenceMin?: number | null
  referenceMax?: number | null
  isNormal?: boolean | null
}

function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doc = await prisma.document.findUnique({ where: { id: params.id } })
    if (!doc) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    if (doc.userId !== payload.userId) return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const patch = (body?.patch && typeof body.patch === 'object') ? body.patch : {}
    const indicatorsPatch: IndicatorPatch[] = Array.isArray(patch?.indicators) ? patch.indicators : []

    // merge indicators
    const currentIndicators: any[] = Array.isArray(doc.indicators) ? (doc.indicators as any[]) : []
    const byName = new Map<string, any>()
    for (const i of currentIndicators) {
      const name = String(i?.name || '').trim()
      if (!name) continue
      byName.set(name.toLowerCase(), { ...i, name })
    }
    for (const p of indicatorsPatch) {
      const name = String(p?.name || '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      const base = byName.get(key) || { name }
      const merged = {
        ...base,
        name,
        ...(p.value !== undefined ? { value: p.value } : {}),
        ...(p.unit !== undefined ? { unit: p.unit } : {}),
        ...(p.referenceMin !== undefined ? { referenceMin: toNumberOrNull(p.referenceMin) } : {}),
        ...(p.referenceMax !== undefined ? { referenceMax: toNumberOrNull(p.referenceMax) } : {}),
        ...(p.isNormal !== undefined ? { isNormal: p.isNormal } : {})
      }
      byName.set(key, merged)
    }
    const mergedIndicators = Array.from(byName.values())

    const updates: any = {}
    if (patch.studyType !== undefined) updates.studyType = patch.studyType || null
    if (patch.studyDate !== undefined) updates.studyDate = patch.studyDate ? new Date(patch.studyDate) : null
    if (patch.laboratory !== undefined) updates.laboratory = patch.laboratory || null
    if (patch.doctor !== undefined) updates.doctor = patch.doctor || null
    if (patch.findings !== undefined) updates.findings = patch.findings || null
    if (patch.rawText !== undefined) updates.rawText = patch.rawText || null
    if (patch.ocrConfidence !== undefined) updates.ocrConfidence = toNumberOrNull(patch.ocrConfidence)
    updates.indicators = mergedIndicators

    const updatedDoc = await prisma.document.update({ where: { id: doc.id }, data: updates })

    // sync linked analysis (if exists)
    const linked = await prisma.analysis.findFirst({
      where: { documentId: doc.id, userId: payload.userId },
      orderBy: { date: 'desc' }
    })
    if (linked) {
      const hasDeviations = mergedIndicators.some((i: any) => i && i.isNormal === false)
      const resultsPayload = {
        indicators: mergedIndicators,
        findings: updatedDoc.findings || null,
        rawTextLength: (updatedDoc.rawText || '').length
      }
      await prisma.analysis.update({
        where: { id: linked.id },
        data: {
          title: updatedDoc.studyType ? `Анализ: ${updatedDoc.studyType}` : updatedDoc.fileName,
          type: updatedDoc.studyType || linked.type,
          date: updatedDoc.studyDate || updatedDoc.uploadDate || linked.date,
          laboratory: updatedDoc.laboratory || null,
          doctor: updatedDoc.doctor || null,
          results: JSON.stringify(resultsPayload),
          status: hasDeviations ? 'abnormal' : 'normal',
          notes: updatedDoc.findings || linked.notes
        }
      })
    }

    return NextResponse.json({ document: updatedDoc })
  } catch (e) {
    console.error('[document-review] error:', e)
    return NextResponse.json({ error: 'Ошибка сохранения исправлений' }, { status: 500 })
  }
}


