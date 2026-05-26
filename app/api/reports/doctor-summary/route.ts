import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
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

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1])
    } catch {}
  }
  const brace = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (brace?.[1]) {
    try {
      return JSON.parse(brace[1])
    } catch {}
  }
  return null
}

function extractIndicators(resultsJson: any) {
  if (!resultsJson) return []
  if (Array.isArray(resultsJson?.indicators)) return resultsJson.indicators
  if (Array.isArray(resultsJson)) return resultsJson
  if (typeof resultsJson === 'object') {
    return Object.entries(resultsJson).map(([name, v]: any) => ({
      name,
      value: v?.value ?? '',
      unit: v?.unit,
      referenceMin: v?.referenceMin ?? null,
      referenceMax: v?.referenceMax ?? null,
      isNormal: v?.isNormal ?? v?.normal ?? null
    }))
  }
  return []
}

function toMarkdownReport(input: {
  patientName: string
  generatedAtIso: string
  complaints?: string
  medications?: string
  summary: any
  rawFacts: {
    lastAnalyses: Array<{ id: string; date: string; title: string; status: string }>
  }
}) {
  const lines: string[] = []
  lines.push(`# Отчёт к приёму (1 страница)`)
  lines.push(``)
  lines.push(`**Пациент:** ${input.patientName}`)
  lines.push(`**Сформировано:** ${new Date(input.generatedAtIso).toLocaleString('ru-RU')}`)
  lines.push(``)

  if (input.complaints) {
    lines.push(`## Жалобы / цель визита`)
    lines.push(input.complaints)
    lines.push(``)
  }
  if (input.medications) {
    lines.push(`## Лекарства / БАДы (со слов пациента)`)
    lines.push(input.medications)
    lines.push(``)
  }

  const s = input.summary || {}

  lines.push(`## Коротко (TL;DR)`)
  lines.push(s.tldr || '—')
  lines.push(``)

  lines.push(`## Problem list`)
  if (Array.isArray(s.problemList) && s.problemList.length > 0) {
    for (const p of s.problemList.slice(0, 8)) {
      if (!p) continue
      const title = p.problem || p.title || 'Проблема'
      const sev = p.severity ? ` (${p.severity})` : ''
      lines.push(`- **${title}**${sev}: ${p.summary || ''}`.trim())
      if (Array.isArray(p.supportingFindings) && p.supportingFindings.length > 0) {
        lines.push(`  - Данные: ${p.supportingFindings.slice(0, 4).join('; ')}`)
      }
      if (Array.isArray(p.questionsForDoctor) && p.questionsForDoctor.length > 0) {
        lines.push(`  - Вопросы врачу: ${p.questionsForDoctor.slice(0, 4).join('; ')}`)
      }
    }
  } else {
    lines.push('—')
  }
  lines.push(``)

  lines.push(`## SOAP`)
  lines.push(`**S (Subjective):** ${s.soap?.S || '—'}`)
  lines.push(`**O (Objective):** ${s.soap?.O || '—'}`)
  lines.push(`**A (Assessment):** ${s.soap?.A || '—'}`)
  lines.push(`**P (Plan):** ${s.soap?.P || '—'}`)
  lines.push(``)

  lines.push(`## Рекомендовано обсудить/уточнить`)
  if (Array.isArray(s.questions) && s.questions.length > 0) lines.push(s.questions.slice(0, 10).map((q: string) => `- ${q}`).join('\n'))
  else lines.push('—')
  lines.push(``)

  lines.push(`## Приложение: последние анализы`)
  for (const a of input.rawFacts.lastAnalyses.slice(0, 12)) {
    lines.push(`- ${new Date(a.date).toLocaleDateString('ru-RU')}: ${a.title} (${a.status}) — /analyses/${a.id}`)
  }
  lines.push(``)

  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const analysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : ''
    const appointmentId = typeof body?.appointmentId === 'string' ? body.appointmentId.trim() : ''
    const days = typeof body?.days === 'number' ? body.days : 180
    const complaints = typeof body?.complaints === 'string' ? body.complaints.trim() : ''
    const medications = typeof body?.medications === 'string' ? body.medications.trim() : ''

    // если передан appointmentId — формируем отчёт "перед визитом" с учётом анкеты
    let reportUserId = payload.userId
    let reportUserName: string | null = null
    let preVisitBlock: any = null
    let derivedComplaints = complaints
    let derivedMedications = medications
    let appointmentForLink: { id: string; patientId: string; doctorId: string } | null = null
    if (appointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, patientId: true, doctorId: true, scheduledAt: true, appointmentType: true }
      })
      if (!appt) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
      appointmentForLink = { id: appt.id, patientId: appt.patientId, doctorId: appt.doctorId }

      // доступ: пациент (владелец) или врач (по doctorId)
      const isPatient = appt.patientId === payload.userId
      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: payload.userId }, select: { id: true } })
      const isDoctor = !!doctorProfile?.id && doctorProfile.id === appt.doctorId
      if (!isPatient && !isDoctor) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

      reportUserId = appt.patientId
      const q = await prisma.preVisitQuestionnaire.findUnique({ where: { appointmentId } })
      preVisitBlock = q?.answers || null
      if (preVisitBlock && typeof preVisitBlock === 'object') {
        const c = typeof (preVisitBlock as any).complaints === 'string' ? (preVisitBlock as any).complaints.trim() : ''
        const g = typeof (preVisitBlock as any).goal === 'string' ? (preVisitBlock as any).goal.trim() : ''
        const d = typeof (preVisitBlock as any).duration === 'string' ? (preVisitBlock as any).duration.trim() : ''
        const v = typeof (preVisitBlock as any).vitals === 'string' ? (preVisitBlock as any).vitals.trim() : ''
        derivedComplaints = [g ? `Цель: ${g}` : '', c ? `Жалобы: ${c}` : '', d ? `Длительность/динамика: ${d}` : '', v ? `Показатели: ${v}` : '']
          .filter(Boolean)
          .join('\n')
        const m = typeof (preVisitBlock as any).currentMedications === 'string' ? (preVisitBlock as any).currentMedications.trim() : ''
        derivedMedications = m || medications
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: reportUserId },
      select: { id: true, name: true }
    })
    if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    reportUserName = user.name

    const since = new Date(Date.now() - Math.max(30, Math.min(3650, days)) * 24 * 60 * 60 * 1000)

    const analyses = await prisma.analysis.findMany({
      where: { userId: reportUserId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { id: true, title: true, type: true, date: true, status: true, results: true, laboratory: true, doctor: true }
    })

    const focus = analysisId ? analyses.find((a) => a.id === analysisId) : analyses[analyses.length - 1]

    // Сбор “фактов” для промпта
    const compactAnalyses = analyses.slice(-25).map((a) => {
      let parsed: any = null
      try {
        parsed = a?.results ? JSON.parse(a.results as unknown as string) : null
      } catch {
        parsed = null
      }
      const inds = extractIndicators(parsed)
        .filter((i: any) => i && i.name && typeof i.value !== 'undefined')
        .slice(0, 30)
        .map((i: any) => ({
          name: i.name,
          value: i.value,
          unit: i.unit,
          referenceMin: i.referenceMin ?? null,
          referenceMax: i.referenceMax ?? null,
          isNormal: i.isNormal ?? null
        }))
      return {
        id: a.id,
        date: (a.date as unknown as Date).toISOString().slice(0, 10),
        title: a.title,
        type: a.type,
        status: a.status,
        lab: a.laboratory ?? null,
        doctor: a.doctor ?? null,
        indicators: inds
      }
    })

    const generatedAtIso = new Date().toISOString()

    let summary: any = null
    const ollamaReady = isOllamaConfigured()
    if (ollamaReady) {
      const systemPrompt = `Ты — медицинский ассистент. Составь "1 страницу к приёму" для врача.

ОГРАНИЧЕНИЯ:
- Не ставь диагнозы. Не выдумывай факты вне данных.
- Пиши по-русски, коротко и структурно.

ОТВЕТ СТРОГО В JSON:
{
  "tldr": "1-3 предложения",
  "problemList": [
    {
      "problem": "string",
      "severity": "low|medium|high",
      "summary": "string",
      "supportingFindings": ["..."],
      "questionsForDoctor": ["..."]
    }
  ],
  "soap": {
    "S": "subjective (если нет данных - что нужно уточнить)",
    "O": "objective (что видно в анализах/динамике)",
    "A": "assessment (без диагноза: гипотезы/что исключить)",
    "P": "plan (какие шаги/анализы/консультации)"
  },
  "questions": ["вопросы врачу (до 10)"]
}`

      const userPrompt = `Пациент: ${reportUserName}
Дата генерации: ${generatedAtIso}
Жалобы/цель визита: ${derivedComplaints || '—'}
Лекарства/БАДы: ${derivedMedications || '—'}
Анкета перед визитом (если есть): ${preVisitBlock ? JSON.stringify(preVisitBlock, null, 2) : '—'}
Фокусный анализ: ${focus ? `${(focus.date as unknown as Date).toISOString().slice(0, 10)} — ${focus.title} (${focus.status})` : '—'}

Данные анализов (последние):
${JSON.stringify(compactAnalyses, null, 2)}
`

      const text = await callOllamaChat({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.2,
        responseFormat: { type: 'json_object' }
      })
      summary = safeJsonParse(text) ?? { tldr: text }
    } else {
      // fallback без ИИ
      const last = compactAnalyses.slice(-1)[0]
      summary = {
        tldr: last ? `Последний анализ: ${last.date} — ${last.title} (${last.status}).` : 'Нет анализов за выбранный период.',
        problemList: [],
        soap: {
          S: complaints || '—',
          O: last ? `По анализам: ${last.title} (${last.status}).` : '—',
          A: '—',
          P: '—'
        },
        questions: ['Какие обследования/анализы нужно добавить для уточнения?', 'Нужна ли консультация профильного специалиста?']
      }
    }

    const markdown = toMarkdownReport({
      patientName: reportUserName,
      generatedAtIso,
      complaints: derivedComplaints || undefined,
      medications: derivedMedications || undefined,
      summary,
      rawFacts: {
        lastAnalyses: analyses
          .slice(-12)
          .map((a) => ({
            id: a.id,
            date: (a.date as unknown as Date).toISOString(),
            title: a.title,
            status: a.status
          }))
      }
    })

    const buf = Buffer.from(markdown, 'utf-8')
    const fileUrl = `data:text/markdown;base64,${buf.toString('base64')}`
    const fileName = `Отчёт к приёму — ${new Date().toLocaleDateString('ru-RU')}.md`

    const doc = await prisma.document.create({
      data: {
        userId: reportUserId,
        fileName,
        fileType: 'text/markdown',
        fileSize: buf.length,
        fileUrl,
        parsed: true,
        category: 'medical_report',
        studyType: 'Отчёт к приёму (для врача)',
        studyDate: new Date(),
        findings: markdown,
        rawText: markdown,
        tags: 'doctor_report'
      }
    })

    // link report to appointment so doctor can find it from their cabinet
    if (appointmentForLink) {
      await prisma.doctorReport.upsert({
        where: { appointmentId: appointmentForLink.id },
        create: {
          appointmentId: appointmentForLink.id,
          doctorId: appointmentForLink.doctorId,
          patientId: appointmentForLink.patientId,
          documentId: doc.id
        },
        update: {
          documentId: doc.id
        }
      }).catch(() => {})
    }

    return NextResponse.json({
      message: 'Отчёт сформирован',
      documentId: doc.id,
      markdown
    })
  } catch (error) {
    console.error('[doctor-summary] error:', error)
    const msg = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


