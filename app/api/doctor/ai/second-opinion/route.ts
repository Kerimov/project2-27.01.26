import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { parse as parseCookies } from 'cookie'

export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try { return JSON.parse(fence[1]) } catch {}
  }
  return null
}

async function doctorCanAccessPatient(doctorId: string, patientId: string) {
  const [record, appt] = await Promise.all([
    prisma.patientRecord.findFirst({ where: { doctorId, patientId }, select: { id: true } }),
    prisma.appointment.findFirst({ where: { doctorId, patientId }, select: { id: true } })
  ])
  return !!(record || appt)
}

type Source = { sourceType: 'analysis' | 'document' | 'previsit'; id: string; label: string; date?: string | null; url?: string | null }

function clip(s: string | null | undefined, max = 1500) {
  const t = String(s || '').trim()
  if (!t) return ''
  return t.length > max ? t.slice(0, max) + '…' : t
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: payload.userId },
      select: { id: true, user: { select: { name: true } } }
    })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === 'string' ? body.patientId.trim() : ''
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const mode = typeof body?.mode === 'string' ? body.mode : 'free'

    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })
    if (!message) return NextResponse.json({ error: 'message обязателен' }, { status: 400 })

    const ok = await doctorCanAccessPatient(doctor.id, patientId)
    if (!ok) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, name: true } })
    if (!patient) return NextResponse.json({ error: 'Пациент не найден' }, { status: 404 })

    // Sources (always returned)
    const [analyses, documents, previsit] = await Promise.all([
      prisma.analysis.findMany({
        where: { userId: patientId },
        orderBy: { date: 'desc' },
        take: 8,
        select: { id: true, title: true, type: true, date: true, status: true, results: true, notes: true, documentId: true }
      }),
      prisma.document.findMany({
        where: { userId: patientId },
        orderBy: { uploadDate: 'desc' },
        take: 8,
        select: { id: true, fileName: true, studyType: true, category: true, studyDate: true, uploadDate: true, findings: true, rawText: true }
      }),
      prisma.preVisitQuestionnaire.findFirst({
        where: { patientId, doctorId: doctor.id, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        select: { id: true, appointmentId: true, submittedAt: true, answers: true }
      })
    ])

    const sources: Source[] = []
    const analysisCtx = analyses.map((a, idx) => {
      const ref = `A${idx + 1}`
      sources.push({
        sourceType: 'analysis',
        id: a.id,
        label: `${ref}: ${a.title || a.type || 'Анализ'} (${String(a.status || '')})`,
        date: a.date ? new Date(a.date).toISOString() : null,
        url: null
      })
      return {
        ref,
        id: a.id,
        title: a.title || null,
        type: a.type || null,
        date: a.date,
        status: a.status,
        results: clip(a.results, 2000),
        notes: clip(a.notes, 800),
        documentId: a.documentId
      }
    })

    const docCtx = documents.map((d, idx) => {
      const ref = `D${idx + 1}`
      sources.push({
        sourceType: 'document',
        id: d.id,
        label: `${ref}: ${d.studyType || d.fileName || 'Документ'} (${d.category || ''})`.trim(),
        date: (d.studyDate || d.uploadDate) ? new Date((d.studyDate || d.uploadDate) as any).toISOString() : null,
        url: `/doctor/documents/${d.id}`
      })
      return {
        ref,
        id: d.id,
        fileName: d.fileName,
        studyType: d.studyType,
        category: d.category,
        studyDate: d.studyDate,
        uploadDate: d.uploadDate,
        findings: clip(d.findings, 2000),
        rawText: clip(d.rawText, 2000)
      }
    })

    const previsitCtx = previsit
      ? (() => {
          const ref = 'P1'
          sources.push({
            sourceType: 'previsit',
            id: previsit.id,
            label: `${ref}: Pre‑visit анкета`,
            date: previsit.submittedAt ? new Date(previsit.submittedAt).toISOString() : null,
            url: `/doctor/appointments/${previsit.appointmentId}/previsit`
          })
          return {
            ref,
            id: previsit.id,
            appointmentId: previsit.appointmentId,
            submittedAt: previsit.submittedAt,
            answers: previsit.answers
          }
        })()
      : null

    if (!isOllamaConfigured()) {
      return NextResponse.json({
        response:
          'AI выключен (нет Ollama). Я могу работать только по данным пациента, но сейчас модель недоступна.\n\n' +
          'Источники доступны ниже — можно включить ключ и повторить запрос.',
        sources,
        timestamp: new Date().toISOString()
      })
    }

    const system = [
      'Ты — AI ассистент врача (second opinion).',
      'ВАЖНО: отвечай строго в рамках предоставленных источников. Никаких внешних знаний и домыслов.',
      'Если данных недостаточно — прямо скажи и перечисли, какие данные нужны.',
      'Всегда указывай, на какие источники опираешься, через ссылки вида [A1], [D2], [P1].',
      'Формат ответа — markdown.',
      '',
      'Ответ верни JSON:',
      '{ "answerMarkdown": "...", "usedRefs": ["A1","D2","P1"], "missingData": ["..."] }'
    ].join('\n')

    const user = JSON.stringify(
      {
        patient: { id: patient.id, name: patient.name },
        doctor: { id: doctor.id, name: doctor.user.name },
        mode,
        question: message,
        sourcesIndex: sources,
        context: { analyses: analysisCtx, documents: docCtx, previsit: previsitCtx }
      },
      null,
      2
    )

    const text = await callOllamaJson(system, user)
    const parsed = safeJsonParse(text)
    const answerMarkdown = typeof parsed?.answerMarkdown === 'string' ? parsed.answerMarkdown : String(text)

    return NextResponse.json({
      response: answerMarkdown,
      sources,
      timestamp: new Date().toISOString()
    })
  } catch (e) {
    console.error('[doctor][ai][second-opinion] error:', e)
    return NextResponse.json({ error: 'Ошибка AI ассистента' }, { status: 500 })
  }
}


