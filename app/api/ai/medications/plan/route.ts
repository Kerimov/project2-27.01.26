import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { callOllamaChat, callOllamaJson, isOllamaConfigured } from '@/lib/ollama'
import { isResolvePatientErr, resolvePatientId } from '@/lib/caretaker-access'

export const dynamic = 'force-dynamic'

function normName(s: string) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function defaultTimes(freq: number) {
  const f = Math.max(1, Math.min(6, Math.floor(freq)))
  if (f === 1) return ['09:00']
  if (f === 2) return ['09:00', '21:00']
  if (f === 3) return ['09:00', '15:00', '21:00']
  if (f === 4) return ['09:00', '13:00', '17:00', '21:00']
  if (f === 5) return ['08:00', '11:00', '14:00', '17:00', '20:00']
  return ['08:00', '12:00', '16:00', '20:00', '22:00', '23:30']
}

function nextDueAt(timeHHmm: string) {
  const now = new Date()
  const [hh, mm] = timeHHmm.split(':').map((x) => Number(x))
  const d = new Date(now)
  d.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0)
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  return d
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const patientIdParam = typeof body?.patientId === 'string' ? body.patientId : null
    const resolved = await resolvePatientId({ payload: decoded, requestedPatientId: patientIdParam, capability: 'medications_read' })
    if (isResolvePatientErr(resolved)) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const createReminders = body?.createReminders !== false
    const channels = Array.isArray(body?.channels) ? body.channels : ['PUSH']

    const meds = await prisma.patientMedication.findMany({
      where: { userId: resolved.patientId },
      orderBy: { createdAt: 'desc' }
    })

    if (meds.length === 0) {
      return NextResponse.json({ result: { warnings: [], schedule: [], tldr: 'Нет лекарств для проверки.' }, usedLLM: false })
    }

    // Basic duplicate-name warnings
    const map = new Map<string, any[]>()
    for (const m of meds) {
      const k = normName(m.name)
      if (!k) continue
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    const warnings: Array<{ severity: 'info' | 'warning' | 'danger'; text: string }> = []
    for (const [k, list] of map.entries()) {
      if (list.length > 1) warnings.push({ severity: 'warning', text: `Похоже, дублируется препарат: "${list[0].name}" (в списке ${list.length} раз).` })
    }

    let schedule: Array<{ medicationId: string; name: string; times: string[]; note?: string }> = meds.map((m) => {
      const existingTimes = Array.isArray(m.times) ? (m.times as any[]).map(String).filter(Boolean) : []
      const freq = typeof m.frequencyPerDay === 'number' && m.frequencyPerDay ? m.frequencyPerDay : (existingTimes.length || 1)
      const times = existingTimes.length ? existingTimes : defaultTimes(freq)
      return {
        medicationId: m.id,
        name: m.name,
        times,
        note: [m.dosage, m.notes].filter(Boolean).join(' • ') || undefined
      }
    })

    // LLM enrichment (optional)
    if (isOllamaConfigured()) {
      try {
        const system = [
          'Ты — медицинский ассистент по лекарствам.',
          'Задача: проверить список лекарств/БАДов на потенциальные взаимодействия и предложить удобное расписание приема.',
          'Важно: не ставь диагноз, не назначай лечение. Пиши осторожно. При неопределенности — задавай вопросы.',
          'Ответ строго JSON (json_object) с полями:',
          '- warnings: array of {severity: "info"|"warning"|"danger", text: string}',
          '- schedule: array of {medicationId: string, name: string, times: string[], note?: string}',
          '- questions: string[] (до 6)',
          '- tldr: string'
        ].join('\n')

        const user = `Список лекарств пациента:\n${JSON.stringify(meds, null, 2)}\n\nТекущее базовое расписание:\n${JSON.stringify(schedule, null, 2)}\n\nВерни улучшенный JSON. В times используй формат "HH:MM". Не выдумывай дозировки.`
        const txt = await callOllamaJson(system, user)
        const parsed = JSON.parse(txt)
        if (Array.isArray(parsed?.warnings)) warnings.push(...parsed.warnings)
        if (Array.isArray(parsed?.schedule)) schedule = parsed.schedule
        const tldr = typeof parsed?.tldr === 'string' ? parsed.tldr : undefined

        // normalize schedule items
        schedule = schedule
          .filter((x: any) => x && typeof x.medicationId === 'string' && typeof x.name === 'string' && Array.isArray(x.times))
          .map((x: any) => ({
            medicationId: x.medicationId,
            name: x.name,
            times: x.times.map(String).map((t) => t.trim()).filter((t) => /^\d{2}:\d{2}$/.test(t)).slice(0, 6),
            note: typeof x.note === 'string' ? x.note : undefined
          }))

        // return later merged
        const resultBase: any = {
          tldr: tldr || 'Готово.',
          warnings: warnings.slice(0, 12),
          schedule,
          questions: Array.isArray(parsed?.questions) ? parsed.questions.slice(0, 6) : [],
          disclaimer: 'Это не медицинская рекомендация. Опасные взаимодействия нужно подтверждать у врача/фармацевта.'
        }

        if (createReminders) {
          const created: any[] = []
          for (const s of schedule) {
            for (const time of s.times) {
              const marker = `[MED:${s.medicationId}][TIME:${time}]`
              const existing = await prisma.reminder.findFirst({
                where: {
                  userId: resolved.patientId,
                  recurrence: 'DAILY',
                  title: `Приём: ${s.name} (${time})`,
                  description: { contains: marker }
                }
              })
              if (existing) continue
              const reminder = await prisma.reminder.create({
                data: {
                  userId: resolved.patientId,
                  title: `Приём: ${s.name} (${time})`,
                  description: `${marker}\n${s.note || ''}`.trim(),
                  dueAt: nextDueAt(time),
                  recurrence: 'DAILY',
                  channels
                }
              })
              created.push(reminder)
            }
            // persist times back to medication
            await prisma.patientMedication.update({
              where: { id: s.medicationId },
              data: { times: s.times }
            }).catch(() => {})
          }
          resultBase.createdReminders = created
        }

        return NextResponse.json({ result: resultBase, usedLLM: true })
      } catch (e) {
        // fall back to rules below
        console.warn('[med-plan] Ollama failed, fallback rules:', e)
      }
    }

    // rules-only result
    const result: any = {
      tldr: 'Расписание сформировано (без Ollama).',
      warnings: warnings.slice(0, 12),
      schedule,
      disclaimer: 'Это не медицинская рекомендация. Опасные взаимодействия нужно подтверждать у врача/фармацевта.'
    }

    if (createReminders) {
      const created: any[] = []
      for (const s of schedule) {
        for (const time of s.times) {
          const marker = `[MED:${s.medicationId}][TIME:${time}]`
          const existing = await prisma.reminder.findFirst({
            where: {
              userId: resolved.patientId,
              recurrence: 'DAILY',
              title: `Приём: ${s.name} (${time})`,
              description: { contains: marker }
            }
          })
          if (existing) continue
          const reminder = await prisma.reminder.create({
            data: {
              userId: resolved.patientId,
              title: `Приём: ${s.name} (${time})`,
              description: `${marker}\n${s.note || ''}`.trim(),
              dueAt: nextDueAt(time),
              recurrence: 'DAILY',
              channels
            }
          })
          created.push(reminder)
        }
        await prisma.patientMedication.update({
          where: { id: s.medicationId },
          data: { times: s.times }
        }).catch(() => {})
      }
      result.createdReminders = created
    }

    return NextResponse.json({ result, usedLLM: false })
  } catch (e) {
    console.error('[ai/medications/plan] error:', e)
    return NextResponse.json({ error: 'Ошибка формирования плана лекарств' }, { status: 500 })
  }
}


