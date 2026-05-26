import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { generateAnalysisComments } from '@/lib/ai-medical-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const analysis = await prisma.analysis.findUnique({ where: { id: params.id } })
    if (!analysis || analysis.userId !== payload.userId) {
      return NextResponse.json({ error: 'Анализ не найден' }, { status: 404 })
    }

    // Парсим результаты
    let indicators: Array<{ name: string; value: string | number; unit?: string; referenceMin?: number | null; referenceMax?: number | null; isNormal?: boolean | null }> = []
    try {
      const parsed = JSON.parse(analysis.results)
      if (parsed && Array.isArray(parsed.indicators)) {
        indicators = parsed.indicators.map((i: any) => ({
          name: i.name,
          value: i.value,
          unit: i.unit,
          referenceMin: i.referenceMin ?? null,
          referenceMax: i.referenceMax ?? null,
          isNormal: i.isNormal ?? null
        }))
      } else if (parsed && typeof parsed === 'object') {
        indicators = Object.entries(parsed).map(([name, v]: any) => ({
          name,
          value: v?.value ?? '',
          unit: v?.unit,
          referenceMin: v?.referenceMin ?? null,
          referenceMax: v?.referenceMax ?? null,
          isNormal: v?.normal ?? null
        }))
      }
    } catch {}

    const comment = await generateAnalysisComments({
      studyType: analysis.type,
      date: analysis.date.toISOString().slice(0, 10),
      laboratory: analysis.laboratory || undefined,
      doctor: analysis.doctor || undefined,
      indicators
    })

    // Сохраним в notes (заменим существующие AI комментарии)
    const existingNotes = analysis.notes?.trim() || ''
    const aiCommentMarker = '--- AI Комментарии ---'
    
    // Удаляем старые AI комментарии если они есть
    const notesWithoutAI = existingNotes.includes(aiCommentMarker) 
      ? existingNotes.split(aiCommentMarker)[0].trim()
      : existingNotes
    
    // Добавляем новые AI комментарии
    const newNotes = notesWithoutAI 
      ? `${notesWithoutAI}\n\n${aiCommentMarker}\n${comment.trim()}`
      : `${aiCommentMarker}\n${comment.trim()}`
    
    await prisma.analysis.update({ where: { id: analysis.id }, data: { notes: newNotes } })

    return NextResponse.json({ comment })
  } catch (e) {
    return NextResponse.json({ error: 'Ошибка генерации комментариев' }, { status: 500 })
  }
}


