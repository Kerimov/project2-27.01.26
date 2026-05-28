import { prisma } from '@/lib/db'
import type { AssistantIntent } from '@/lib/ai/assistant-router'
import { isAnalysisListOnlyRequest } from '@/lib/ai/assistant-analysis-intent'
import {
  collectUserAbnormalIndicators,
  formatAbnormalIndicatorsForChat,
} from '@/lib/ai/assistant-abnormal-indicators'
import {
  buildIndicatorSeries,
  parseAnalysisResultsMap,
} from '@/lib/analysis-indicator-series'
import {
  extractIndicatorsFromResults,
  formatTriageLevelRu,
  ruleBasedTriage,
} from '@/lib/ai/risk-triage-core'
import type { AssistantPatientContext } from '@/lib/ai/assistant-patient-context'
import type { AssistantProjectActionResult } from '@/lib/ai/assistant-project-types'

export type { AssistantProjectActionResult } from '@/lib/ai/assistant-project-types'

function norm(s: string) {
  return (s || '').toLowerCase().replace(/ё/g, 'е').trim()
}

function extractDateFromMessage(message: string): Date | null {
  const m = message.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?|(завтра|послезавтра|через\s+(\d+)\s+дн)/i)
  if (!m) return null
  const d = new Date()
  if (m[4]) {
    const w = m[4].toLowerCase()
    if (w === 'завтра') d.setDate(d.getDate() + 1)
    if (w === 'послезавтра') d.setDate(d.getDate() + 2)
    if (m[5] && m[6]) d.setDate(d.getDate() + Number(m[6]))
    d.setHours(9, 0, 0, 0)
    return d
  }
  if (m[1] && m[2]) {
    const day = m[1].padStart(2, '0')
    const month = m[2].padStart(2, '0')
    const year = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(d.getFullYear())
    return new Date(`${year}-${month}-${day}T09:00:00`)
  }
  return null
}

function extractMonthsFilter(message: string): number | null {
  const m = message.match(/(?:за|последн)\s*(\d+)\s*мес/i)
  if (m?.[1]) return Math.min(24, Math.max(1, Number(m[1])))
  if (/за\s+месяц|последн.*месяц/i.test(message)) return 1
  if (/за\s+недел/i.test(message)) return 0.25
  return null
}

function parseReminderFromMessage(message: string): { title: string; dueAt: Date; recurrence: string; channels: string[] } | null {
  const titleMatch = message.match(/напоминани[ея]?\s*[:\-]?\s*([^,\n.]+)/i) || message.match(/напомни\s+(?:мне\s+)?(.+)/i)
  const title = (titleMatch?.[1] || 'Напоминание').trim().slice(0, 200)
  const due = extractDateFromMessage(message) || new Date(Date.now() + 24 * 60 * 60 * 1000)
  const channels: string[] = []
  if (/sms/i.test(message)) channels.push('SMS')
  if (/email|почт/i.test(message)) channels.push('EMAIL')
  if (/push|пуш/i.test(message) || channels.length === 0) channels.push('PUSH')
  let recurrence = 'NONE'
  if (/ежедневн/i.test(message)) recurrence = 'DAILY'
  if (/еженедел/i.test(message)) recurrence = 'WEEKLY'
  if (/ежемесяч/i.test(message)) recurrence = 'MONTHLY'
  return { title, dueAt: due, recurrence, channels }
}

function parseMedicationFromMessage(message: string): {
  name: string
  dosage?: string
  times?: string[]
  frequencyPerDay?: number
} | null {
  const add = /(?:добав|внеси|запиш).*(?:лекарств|препарат|таблетк)/i.test(message)
  if (!add && !/лекарств[оа]\s*:/i.test(message)) return null
  const nameMatch =
    message.match(/(?:лекарств[оа]|препарат)\s*[:\-]\s*([^,\n]+)/i) ||
    message.match(/(?:добав(?:ь|ить)?)\s+([^,\n]+?)(?:\s+\d|\s+мг|,|$)/i)
  const name = (nameMatch?.[1] || '').trim().replace(/\s+\d+\s*мг.*/i, '').slice(0, 120)
  if (!name || name.length < 2) return null
  const dosage = message.match(/(\d+(?:[.,]\d+)?\s*мг)/i)?.[1] || undefined
  const times = [...message.matchAll(/(?:в\s*)?(\d{1,2})[.:](\d{2})/g)].map((m) =>
    `${m[1].padStart(2, '0')}:${m[2]}`
  )
  const freq = message.match(/(\d)\s*раз\s*в\s*день/i)?.[1]
  return {
    name,
    dosage,
    times: times.length ? times : undefined,
    frequencyPerDay: freq ? Number(freq) : undefined,
  }
}

function asciiSparkline(values: number[], width = 12): string {
  if (!values.length) return '—'
  const min = Math.min(...values)
  const max = Math.max(...values)
  const chars = '▁▂▃▄▅▆▇█'
  if (max === min) return chars[4].repeat(Math.min(width, values.length))
  const slice = values.slice(-width)
  return slice
    .map((v) => {
      const idx = Math.round(((v - min) / (max - min)) * (chars.length - 1))
      return chars[Math.max(0, Math.min(chars.length - 1, idx))]
    })
    .join('')
}

export async function tryAssistantExtendedAction(input: {
  message: string
  intent: AssistantIntent
  ctx: AssistantPatientContext
}): Promise<AssistantProjectActionResult | null> {
  const { message, intent, ctx } = input
  const { patientId, prefix } = ctx
  const t = norm(message)

  const emergency =
    /боль\s+в\s+груди|давит\s+в\s+груди|одышк\w*\s+в\s+покое|потер[яи]\s+сознан|судорог|анафилакси|перекос\s+лица|нарушен\w*\s+речи|сильн\w*\s+кровотеч/i.test(
      t
    )
  if (emergency) {
    return {
      functionName: 'emergency_escalation',
      message: `${prefix}**ТРЕБУЕТСЯ ЭКСТРЕННАЯ ПОМОЩЬ. НЕМЕДЛЕННО ВЫЗОВИТЕ СКОРУЮ ПО ТЕЛЕФОНУ 103 (112).**\n\nПрекратите нагрузку, обеспечьте покой. Уложите пациента, расстегните воротник, не давайте еду и питьё до приезда врачей (если нет иного указания специалистов). Ждите бригаду.`,
      data: { action: 'emergency' },
      safety: {
        level: 'urgent',
        message: 'Экстренная ситуация — вызовите скорую 103 (112).',
      },
    }
  }

  // ——— Куратор ———
  if (intent === 'caretaker' || /(?:куратор|подопечн|связанн.*пациент|переключ.*пациент)/i.test(message)) {
    const links = await prisma.careRelationship.findMany({
      where: { caretakerId: ctx.actorUserId },
      include: { patient: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    if (links.length === 0) {
      return {
        functionName: 'caretaker_list',
        message: 'У вас нет связанных пациентов в режиме куратора.',
        data: { action: 'caretaker_empty', patients: [] },
      }
    }
    const lines = links.map(
      (l, i) => `${i + 1}. ${l.patient.name} (${l.patient.email || l.patient.id.slice(0, 8)})`
    )
    return {
      functionName: 'caretaker_list',
      message: `Связанные пациенты:\n${lines.join('\n')}\n\nУкажите в чате «для [имя]» или выберите пациента в переключателе куратора.`,
      data: {
        action: 'caretaker_patients',
        patients: links.map((l) => ({ id: l.patient.id, name: l.patient.name })),
      },
    }
  }

  // ——— Аналитика / KPI ———
  if (intent === 'analytics' || /(?:kpi|дашборд|статистик|сколько\s+у\s+меня)/i.test(message)) {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 30)
    const [documentsCount, analysesCount, upcomingAppointments, entries] = await Promise.all([
      prisma.document.count({ where: { userId: patientId } }),
      prisma.analysis.count({ where: { userId: patientId } }),
      prisma.appointment.count({
        where: {
          patientId,
          scheduledAt: { gte: new Date() },
          status: { in: ['scheduled', 'confirmed', 'rescheduled'] },
        },
      }),
      prisma.healthDiaryEntry.findMany({
        where: { userId: patientId, entryDate: { gte: from, lte: to } },
        orderBy: { entryDate: 'asc' },
      }),
    ])
    const sleepVals = entries.map((e) => e.sleepHours).filter((v): v is number => typeof v === 'number')
    const sysVals = entries.map((e) => e.systolic).filter((v): v is number => typeof v === 'number')
    const sleepSpark = asciiSparkline(sleepVals)
    const bpSpark = asciiSparkline(sysVals)
    const avgSleep =
      sleepVals.length > 0
        ? Math.round((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length) * 10) / 10
        : null

    return {
      functionName: 'dashboard_kpi',
      message: `${prefix}📊 **KPI кабинета**
• Анализов: ${analysesCount}
• Документов: ${documentsCount}
• Предстоящих визитов: ${upcomingAppointments}
${avgSleep != null ? `• Средний сон (30 дн.): ${avgSleep} ч\n• Тренд сна: ${sleepSpark}` : '• Сон: нет записей в дневнике за 30 дней'}
${sysVals.length ? `• Тренд систол. АД: ${bpSpark}` : ''}

Хотите разбор анализов, недельный обзор дневника или запись к врачу?`,
      data: {
        action: 'dashboard_kpi',
        kpi: { documentsCount, analysesCount, upcomingAppointments, avgSleep },
      },
    }
  }

  // ——— Маркетплейс ———
  if (intent === 'marketplace') {
    const cityMatch = message.match(/(?:в|город)\s+([А-Яа-яA-Za-z\-]+)/i)
    const city = cityMatch?.[1] || 'Москва'
    const type = /лаборатор/i.test(message) ? 'LABORATORY' : /аптек/i.test(message) ? 'PHARMACY' : 'CLINIC'
    const search = message.replace(/найди|клиник|лаборатор|маркетплейс|в городе/gi, '').trim().slice(0, 80)

    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
        type: type as any,
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
        ...(search.length >= 3
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: 8,
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
    })

    if (companies.length === 0) {
      return {
        functionName: 'marketplace_search',
        message: `${prefix}В каталоге не найдено организаций (${type}, ${city}). Уточните город или откройте «Маркетплейс».`,
        data: { action: 'marketplace_empty', city, type },
      }
    }

    const lines = companies.map((c, i) => {
      const rating = c.rating != null ? ` ★${c.rating.toFixed(1)}` : ''
      const addr = c.address ? `, ${c.address}` : ''
      return `${i + 1}. **${c.name}**${rating}${addr}${c.phone ? `, тел. ${c.phone}` : ''}`
    })
    return {
      functionName: 'marketplace_search',
      message: `${prefix}Найдено в ${city}:\n${lines.join('\n')}\n\nПодробнее — раздел «Маркетплейс». Запись через интеграцию — если доступна у организации.`,
      data: { action: 'marketplace', companies: companies.map((c) => ({ id: c.id, name: c.name, city: c.city })) },
    }
  }

  // ——— База знаний (показатель) ———
  if (intent === 'knowledge' || /что\s+такое|что\s+означает|расшифруй\s+показатель|референс/i.test(message)) {
    const term =
      message.match(/(?:что\s+такое|что\s+означает|расшифруй)\s+([а-яa-z0-9\-]+)/i)?.[1] ||
      message.match(/\b(ттг|лпнп|лпвп|срб|ферритин|гемоглобин|глюкоз|креатинин|мочевой)\b/i)?.[1]
    if (term) {
      const indicators = await prisma.indicator.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { shortName: { contains: term, mode: 'insensitive' } },
            { nameEn: { contains: term, mode: 'insensitive' } },
          ],
          isActive: true,
        },
        include: { referenceRanges: { include: { methodology: true }, take: 3 } },
        take: 1,
      })
      const ind = indicators[0]
      if (ind) {
        const refs = (ind.referenceRanges || [])
          .slice(0, 3)
          .map((r) => {
            const meth = r.methodology?.name || r.methodologyId || 'стандарт'
            return `• ${meth}: ${r.minValue ?? '—'}–${r.maxValue ?? '—'} ${ind.unit || ''}`.trim()
          })
          .join('\n')
        return {
          functionName: 'knowledge_indicator',
          message: `${prefix}**${ind.name}**${ind.shortName ? ` (${ind.shortName})` : ''}
${ind.description || 'Описание в базе знаний.'}

${refs ? `Референсы:\n${refs}` : 'Референсы уточняйте у лаборатории и врача.'}

Это справочная информация, не диагноз. Источник: база знаний PMA.`,
          data: { action: 'knowledge', indicatorId: ind.id },
        }
      }
    }
  }

  // ——— Медицинский отчёт ———
  if (/medical_report|медицинск.*отч[её]т|сводк.*за\s+период/i.test(message)) {
    const months = extractMonthsFilter(message) || 3
    const from = new Date()
    from.setMonth(from.getMonth() - Math.ceil(months))
    const [analyses, entries, meds, appts] = await Promise.all([
      prisma.analysis.findMany({
        where: { userId: patientId, date: { gte: from } },
        orderBy: { date: 'desc' },
        take: 15,
      }),
      prisma.healthDiaryEntry.findMany({
        where: { userId: patientId, entryDate: { gte: from } },
        orderBy: { entryDate: 'desc' },
        take: 20,
      }),
      prisma.patientMedication.findMany({ where: { userId: patientId }, take: 15 }),
      prisma.appointment.findMany({
        where: { patientId, scheduledAt: { gte: from } },
        include: { doctor: { include: { user: true } } },
        take: 10,
      }),
    ])
    const abnormal = await collectUserAbnormalIndicators(patientId, 15)
    const md = [
      `# Медицинская сводка`,
      `_Не является диагнозом. Для решений обратитесь к врачу._`,
      ``,
      `**Период:** с ${from.toLocaleDateString('ru-RU')} по ${new Date().toLocaleDateString('ru-RU')}`,
      ctx.patientName ? `**Пациент:** ${ctx.patientName}` : '',
      ``,
      `## Анализы (${analyses.length})`,
      ...analyses.map((a) => `- ${a.title} (${new Date(a.date).toLocaleDateString('ru-RU')}), статус: ${a.status}`),
      ``,
      `## Отклонения`,
      abnormal.length
        ? abnormal.slice(0, 8).map((r) => `- ${r.indicatorName}: ${r.value} (${new Date(r.analysisDate).toLocaleDateString('ru-RU')})`)
        : ['- Нет отмеченных отклонений'],
      ``,
      `## Дневник (${entries.length} записей)`,
      ...entries.slice(0, 5).map((e) => {
        const parts = []
        if (e.mood != null) parts.push(`настроение ${e.mood}/5`)
        if (e.painScore != null) parts.push(`боль ${e.painScore}/10`)
        if (e.sleepHours != null) parts.push(`сон ${e.sleepHours}ч`)
        return `- ${new Date(e.entryDate).toLocaleDateString('ru-RU')}: ${parts.join(', ') || 'запись'}`
      }),
      ``,
      `## Лекарства`,
      ...meds.map((m) => `- ${m.name}${m.dosage ? `, ${m.dosage}` : ''}`),
      ``,
      `## Визиты`,
      ...appts.map(
        (a) =>
          `- ${new Date(a.scheduledAt).toLocaleDateString('ru-RU')} — ${a.doctor?.user?.name || 'врач'}, ${a.status}`
      ),
    ].join('\n')

    return {
      functionName: 'medical_report',
      message: `${prefix}${md}`,
      data: { action: 'medical_report', format: 'markdown' },
    }
  }

  // ——— Напоминания: создать / удалить ———
  if (intent === 'reminders') {
    if (/(?:создай|добав|новое|поставь).*(?:напоминан)|напомни\s+(?:мне\s+)?(?:через|в|завтра)/i.test(message)) {
      const parsed = parseReminderFromMessage(message)
      if (parsed) {
        const pref = await prisma.reminderPreference.findUnique({ where: { userId: patientId } })
        const channels = parsed.channels.filter((c) => {
          if (c === 'SMS' && pref && !pref.sms) return false
          if (c === 'EMAIL' && pref && !pref.email) return false
          if (c === 'PUSH' && pref && !pref.push) return false
          return true
        })
        const reminder = await prisma.reminder.create({
          data: {
            userId: patientId,
            title: parsed.title,
            dueAt: parsed.dueAt,
            recurrence: parsed.recurrence as any,
            channels: channels.length ? channels : ['PUSH'],
          },
        })
        return {
          functionName: 'create_reminder',
          message: `${prefix}Создаю напоминание: «${reminder.title}» на ${reminder.dueAt.toLocaleString('ru-RU')} (каналы: ${(reminder.channels as string[]).join(', ')}). Нужно что-то ещё?`,
          data: { action: 'reminder_created', reminder },
        }
      }
    }
    if (/(?:удали|отмени|убери).*(?:напоминан)/i.test(message)) {
      const reminders = await prisma.reminder.findMany({
        where: { userId: patientId },
        orderBy: { dueAt: 'asc' },
        take: 5,
      })
      const target = reminders[0]
      if (target) {
        await prisma.reminder.delete({ where: { id: target.id } })
        return {
          functionName: 'delete_reminder',
          message: `${prefix}Напоминание «${target.title}» удалено.`,
          data: { action: 'reminder_deleted', id: target.id },
        }
      }
    }
  }

  // ——— Лекарства: добавить / удалить / взаимодействия / план ———
  if (intent === 'medications') {
    if (/взаимодейств|совместим|можно\s+ли\s+вместе/i.test(message)) {
      const meds = await prisma.patientMedication.findMany({ where: { userId: patientId } })
      if (meds.length < 2) {
        return {
          functionName: 'medication_interactions',
          message: `${prefix}Для проверки взаимодействий нужно минимум 2 препарата в списке.`,
          data: { action: 'interactions_need_more' },
        }
      }
      const names = meds.map((m) => m.name).join(', ')
      return {
        functionName: 'medication_interactions',
        message: `${prefix}Активные препараты: ${names}.\n\nАвтоматическая проверка взаимодействий в чате — ориентировочная. **Окончательно совместимость оценивает врач или фармацевт.** При появлении побочных эффектов — обратитесь к специалисту.\n\nХотите сформировать план напоминаний о приёме? (напишите «план приёма лекарств»)`,
        data: { action: 'interactions', medications: meds.map((m) => m.id) },
      }
    }
    if (/план\s+(?:при[её]ма|напоминан)|напоминан.*лекарств/i.test(message)) {
      return {
        functionName: 'medication_reminder_plan',
        message: `${prefix}Чтобы сгенерировать план напоминаний о приёме с учётом времени суток, откройте «Дневник → Лекарства» → «План напоминаний» или напишите «создай напоминание принять [название] в 8:00».`,
        data: { action: 'medication_plan_hint', link: '/diary?tab=medications' },
      }
    }
    const medParsed = parseMedicationFromMessage(message)
    if (medParsed) {
      const created = await prisma.patientMedication.create({
        data: {
          userId: patientId,
          name: medParsed.name,
          dosage: medParsed.dosage || null,
          times: medParsed.times || undefined,
          frequencyPerDay: medParsed.frequencyPerDay || null,
        },
      })
      return {
        functionName: 'add_medication',
        message: `${prefix}Добавлен препарат: **${created.name}**${created.dosage ? `, ${created.dosage}` : ''}. Не изменяйте терапию, назначенную врачом, без консультации.`,
        data: { action: 'medication_created', medication: created },
      }
    }
    if (/(?:удали|убери|отмени).*(?:лекарств|препарат)/i.test(message)) {
      const meds = await prisma.patientMedication.findMany({ where: { userId: patientId }, take: 10 })
      const nameHint = message.match(/(?:лекарств[оа]|препарат)\s+([^\n,.]+)/i)?.[1]?.trim()
      const target = nameHint
        ? meds.find((m) => m.name.toLowerCase().includes(nameHint.toLowerCase()))
        : meds[0]
      if (target) {
        await prisma.patientMedication.delete({ where: { id: target.id } })
        return {
          functionName: 'delete_medication',
          message: `${prefix}Препарат «${target.name}» удалён из списка (назначения врача это не отменяет).`,
          data: { action: 'medication_deleted', id: target.id },
        }
      }
    }
  }

  // ——— Анализы: сравнение, triage, группировка, создание ———
  if (intent === 'analyses' || intent === 'medical_question') {
    if (/сравни|сравнение|динамик|тренд/i.test(message) && /анализ/i.test(message)) {
      const analyses = await prisma.analysis.findMany({
        where: { userId: patientId },
        orderBy: { date: 'desc' },
        take: 6,
        select: { id: true, title: true, date: true, results: true },
      })
      if (analyses.length < 2) {
        return {
          functionName: 'compare_analyses',
          message: `${prefix}Для сравнения нужно минимум 2 анализа в кабинете.`,
          data: { action: 'compare_need_more' },
        }
      }
      const ordered = [...analyses].reverse()
      const indicatorName =
        message.match(/(?:показател[ьу]|уровень)\s+([а-яa-z0-9\-]+)/i)?.[1] ||
        message.match(/\b(глюкоз|лпнп|лпвп|ферритин|гемоглобин|ттг|холестерин)\b/i)?.[1]
      if (indicatorName) {
        const series = buildIndicatorSeries(ordered, indicatorName)
        if (series.length >= 2) {
          const first = series[0]
          const last = series[series.length - 1]
          const pct =
            first.value !== 0
              ? Math.round(((last.value - first.value) / Math.abs(first.value)) * 100)
              : 0
          const table = series
            .map((p) => `| ${p.date.slice(0, 10)} | ${p.value}${p.unit ? ' ' + p.unit : ''} |`)
            .join('\n')
          return {
            functionName: 'compare_analyses',
            message: `${prefix}**${indicatorName}** — динамика:\n| Дата | Значение |\n|---|---|\n${table}\n\nИзменение: ${pct >= 0 ? '+' : ''}${pct}% (возможные причины — только с врачом). Срочность: ${pct > 15 ? 'обсудите с врачом' : 'наблюдение'}.`,
            data: { action: 'compare', series },
          }
        }
      }
      const lines: string[] = []
      for (const a of ordered) {
        const map = parseAnalysisResultsMap(a.results)
        const abn = Object.entries(map).filter(([, r]) => r.normal === false)
        lines.push(
          `**${a.title}** (${new Date(a.date).toLocaleDateString('ru-RU')}): ${abn.length ? abn.map(([n]) => n).slice(0, 5).join(', ') : 'без отклонений'}`
        )
      }
      return {
        functionName: 'compare_analyses',
        message: `${prefix}Сравнение последних анализов:\n${lines.join('\n')}\n\nУточните показатель: «сравни глюкозу» или «тренд ЛПНП».`,
        data: { action: 'compare_summary', analysisIds: analyses.map((a) => a.id) },
      }
    }

    if (/triage|срочност|оцени\s+(?:риск|срочность)|насколько\s+опасно/i.test(message)) {
      const latest = await prisma.analysis.findFirst({
        where: { userId: patientId },
        orderBy: { date: 'desc' },
      })
      if (!latest) {
        return {
          functionName: 'analysis_triage',
          message: `${prefix}Нет анализов для оценки срочности.`,
          data: { action: 'triage_empty' },
        }
      }
      const indicators = extractIndicatorsFromResults(latest.results)
      const triage = ruleBasedTriage({
        analysisStatus: latest.status,
        indicators,
        symptoms: message,
      })
      return {
        functionName: 'analysis_triage',
        message: `${prefix}**Срочность (triage):** ${formatTriageLevelRu(triage.level)} (уверенность ~${triage.confidence}%)\n${triage.reasons.map((r) => `• ${r}`).join('\n')}\n\n**Рекомендации:**\n${triage.nextSteps.map((s) => `• ${s}`).join('\n')}`,
        data: { action: 'triage', level: triage.level, analysisId: latest.id },
        safety:
          triage.level === 'urgent'
            ? {
                level: 'urgent',
                message: 'ТРЕБУЕТСЯ ЭКСТРЕННАЯ ПОМОЩЬ при опасных симптомах. Вызовите скорую 103 (112).',
              }
            : triage.level === 'attention'
              ? { level: 'caution', message: 'Есть отклонения — обсудите с врачом в ближайшую неделю.' }
              : undefined,
      }
    }

    if (/(?:создай|добав|внеси).*(?:анализ)/i.test(message)) {
      const title = message.match(/анализ[:\s]+([^\n,.]+)/i)?.[1]?.trim() || 'Анализ из чата'
      const resultsBody = message.match(/показател[ьи][:\s]+(.+)/i)?.[1]
      let results: Record<string, unknown> = { indicators: [], source: 'chat_manual' }
      if (resultsBody) {
        const pairs = resultsBody.split(/[,;]/).map((s) => s.trim())
        const indicators = pairs
          .map((p) => {
            const m = p.match(/(.+?)\s*[=:]\s*([\d.,]+)/)
            if (!m) return null
            return { name: m[1].trim(), value: m[2], isNormal: null }
          })
          .filter(Boolean)
        if (indicators.length) results = { indicators, source: 'chat_manual' }
      }
      const created = await prisma.analysis.create({
        data: {
          userId: patientId,
          title: title.slice(0, 200),
          type: 'manual',
          date: new Date(),
          results: JSON.stringify(results),
          status: 'normal',
        },
      })
      return {
        functionName: 'create_analysis',
        message: `${prefix}Анализ «${created.title}» создан. Добавьте показатели в разделе «Анализы» или загрузите документ для OCR.`,
        data: { action: 'analysis_created', analysis: { id: created.id } },
      }
    }

    if (/по\s+категор|группир|разбей\s+по/i.test(message)) {
      const list = await prisma.analysis.findMany({
        where: { userId: patientId },
        orderBy: { date: 'desc' },
        take: 30,
      })
      const groups: Record<string, typeof list> = {}
      for (const a of list) {
        const key = a.type || 'Прочее'
        if (!groups[key]) groups[key] = []
        groups[key].push(a)
      }
      const text = Object.entries(groups)
        .map(([k, items]) => `**${k}** (${items.length}):\n${items.slice(0, 5).map((a) => `  • ${a.title} — ${new Date(a.date).toLocaleDateString('ru-RU')}`).join('\n')}`)
        .join('\n\n')
      return {
        functionName: 'get_analysis_results',
        message: `${prefix}Анализы по категориям:\n\n${text}`,
        data: { action: 'analyses_grouped', groups: Object.keys(groups) },
      }
    }

    if (/карточк|детальн|подробн|разбор\s+анализ/i.test(message) && !isAnalysisListOnlyRequest(message)) {
      const latest = await prisma.analysis.findFirst({
        where: { userId: patientId },
        orderBy: { date: 'desc' },
      })
      if (latest) {
        const map = parseAnalysisResultsMap(latest.results)
        const lines = Object.entries(map)
          .slice(0, 25)
          .map(([name, row]) => {
            const flag = row.normal === false ? ' ⚠️' : row.normal === true ? ' ✅' : ''
            return `- ${name}: ${row.value}${row.unit ? ' ' + row.unit : ''}${flag}`
          })
        return {
          functionName: 'get_analysis_detail',
          message: `${prefix}**${latest.title}** (${new Date(latest.date).toLocaleDateString('ru-RU')})\n${lines.join('\n') || 'Показатели не распознаны.'}\n\nНе диагноз. Хотите triage или сравнение с прошлым анализом?`,
          data: { action: 'analysis_detail', analysisId: latest.id },
        }
      }
    }

    if (/напоминан.*пересдать|пересдать.*через/i.test(message)) {
      const months = message.match(/через\s+(\d+)\s+мес/i)?.[1] || '3'
      const due = new Date()
      due.setMonth(due.getMonth() + Number(months))
      const title = 'Пересдать анализ (по рекомендации ассистента)'
      const reminder = await prisma.reminder.create({
        data: {
          userId: patientId,
          title,
          dueAt: due,
          recurrence: 'NONE',
          channels: ['PUSH'],
        },
      })
      return {
        functionName: 'create_reminder',
        message: `${prefix}Напоминание пересдать анализ через ${months} мес. (${due.toLocaleDateString('ru-RU')}). Подтвердите вид анализа у врача.`,
        data: { action: 'reminder_created', reminder },
      }
    }
  }

  // ——— План ухода: отложить, чек-ин ———
  if (intent === 'care_plan') {
    if (/(?:отлож|snooze|не\s+сделал|почему\s+не)/i.test(message)) {
      const tasks = await prisma.carePlanTask.findMany({
        where: { userId: patientId, status: 'ACTIVE' },
        take: 5,
      })
      const task = tasks[0]
      if (!task) {
        return {
          functionName: 'snooze_task',
          message: `${prefix}Нет активных задач для отложения.`,
          data: { action: 'tasks_empty' },
        }
      }
      const reason = message.match(/причин[аы][:\s]+([^\n]+)/i)?.[1]?.trim() || 'Отложено через чат'
      const snoozedUntil = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      await prisma.carePlanTask.update({
        where: { id: task.id },
        data: { status: 'SNOOZED', snoozedUntil },
      })
      await prisma.carePlanCheckIn.create({
        data: { taskId: task.id, type: 'SNOOZE', reason: reason.slice(0, 800) },
      })
      return {
        functionName: 'snooze_task',
        message: `${prefix}Задача «${task.title}» отложена до ${snoozedUntil.toLocaleDateString('ru-RU')}. Причина: ${reason}.\n\nАльтернатива: упростить задачу или обсудить с врачом.`,
        data: { action: 'task_snoozed', taskId: task.id },
      }
    }
    if (/согласован|на\s+проверк|approval|врач.*подтверд/i.test(message)) {
      const pending = await prisma.carePlanTask.findMany({
        where: { userId: patientId, approvalStatus: 'PENDING' },
        take: 5,
      })
      if (pending.length) {
        return {
          functionName: 'care_plan_approval',
          message: `${prefix}Ожидают согласования с врачом (${pending.length}): ${pending.map((t) => t.title).join('; ')}. Откройте «Дневник → План».`,
          data: { action: 'approval_pending', tasks: pending.map((t) => t.id) },
        }
      }
      return {
        functionName: 'request_approval',
        message: `${prefix}Чтобы отправить задачу на согласование врачу, создайте её в плане ухода — статус «на проверке» появится после запроса в интерфейсе плана.`,
        data: { action: 'approval_hint' },
      }
    }
  }

  // ——— Записи: отмена, pre-visit ———
  if (intent === 'appointments' || intent === 'booking') {
    if (/(?:отмени|отменить)\s+(?:запись|при[её]м|визит)/i.test(message)) {
      const appt = await prisma.appointment.findFirst({
        where: { patientId, scheduledAt: { gte: new Date() }, status: { not: 'cancelled' } },
        orderBy: { scheduledAt: 'asc' },
        include: { doctor: { include: { user: true } } },
      })
      if (appt) {
        await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'cancelled' } })
        return {
          functionName: 'cancel_appointment',
          message: `${prefix}Запись на ${new Date(appt.scheduledAt).toLocaleString('ru-RU')} к ${appt.doctor?.user?.name || 'врачу'} отменена.`,
          data: { action: 'appointment_cancelled', appointmentId: appt.id },
        }
      }
    }
    if (/анкет|pre-?visit|перед\s+визитом|перед\s+при[её]мом/i.test(message)) {
      const appt = await prisma.appointment.findFirst({
        where: { patientId, scheduledAt: { gte: new Date() }, status: { not: 'cancelled' } },
        orderBy: { scheduledAt: 'asc' },
        include: { doctor: { include: { user: true } } },
      })
      if (!appt) {
        return {
          functionName: 'previsit_questionnaire',
          message: `${prefix}Нет предстоящих записей для анкеты.`,
          data: { action: 'previsit_no_appointment' },
        }
      }
      const answersMatch = message.match(/(?:жалоб[ыа]|симптом[ыа]|ответ)[:\s]+([^\n]+)/gi)
      if (answersMatch && answersMatch.length > 0) {
        const answers: Record<string, string> = {}
        for (const part of answersMatch) {
          const m = part.match(/([^:]+):\s*(.+)/)
          if (m) answers[m[1].trim()] = m[2].trim()
        }
        await prisma.preVisitQuestionnaire.upsert({
          where: { appointmentId: appt.id },
          create: {
            appointmentId: appt.id,
            patientId,
            doctorId: appt.doctorId,
            answers,
            submittedAt: new Date(),
          },
          update: { answers, submittedAt: new Date() },
        })
        return {
          functionName: 'previsit_questionnaire',
          message: `${prefix}Анкета перед визитом сохранена для записи ${new Date(appt.scheduledAt).toLocaleDateString('ru-RU')}.`,
          data: { action: 'previsit_saved', appointmentId: appt.id },
        }
      }
      return {
        functionName: 'previsit_questionnaire',
        message: `${prefix}Анкета перед визитом к ${appt.doctor?.user?.name || 'врачу'} (${new Date(appt.scheduledAt).toLocaleString('ru-RU')}).\n\nОтветьте одним сообщением:\n• **Жалобы:** …\n• **Симптомы:** …\n• **Что принимаете:** …\n• **Вопросы врачу:** …`,
        data: { action: 'previsit_questions', appointmentId: appt.id },
      }
    }
  }

  // ——— Дневник: период, связь с анализом ———
  if (intent === 'diary') {
    if (/связь|корреляц|сопостав/i.test(message) && /анализ|показател/i.test(message)) {
      const abnormal = await collectUserAbnormalIndicators(patientId, 5)
      const entries = await prisma.healthDiaryEntry.findMany({
        where: { userId: patientId },
        orderBy: { entryDate: 'desc' },
        take: 14,
      })
      const painHigh = entries.filter((e) => (e.painScore ?? 0) >= 5)
      let text = formatAbnormalIndicatorsForChat(abnormal)
      if (painHigh.length) {
        text += `\n\nВ дневнике ${painHigh.length} записей с болью ≥5/10 — можно обсудить с врачом вместе с показателями анализов.`
      }
      return {
        functionName: 'diary_analysis_link',
        message: `${prefix}${text}`,
        data: { action: 'diary_analysis_link' },
      }
    }
    const months = extractMonthsFilter(message)
    if (months != null || /за\s+период|с\s+\d{1,2}\./i.test(message)) {
      const from = new Date()
      from.setDate(from.getDate() - Math.ceil((months || 1) * 30))
      const entries = await prisma.healthDiaryEntry.findMany({
        where: { userId: patientId, entryDate: { gte: from } },
        orderBy: { entryDate: 'desc' },
        take: 15,
        include: { tags: { include: { tag: true } } },
      })
      const tagFilter = message.match(/тег[:\s]+([^\n,]+)/i)?.[1]?.trim().toLowerCase()
      const filtered = tagFilter
        ? entries.filter((e) =>
            e.tags?.some((t) => t.tag.name.toLowerCase().includes(tagFilter))
          )
        : entries
      if (filtered.length === 0) {
        return {
          functionName: 'get_diary_entries',
          message: `${prefix}За выбранный период записей нет.`,
          data: { action: 'diary_empty' },
        }
      }
      const lines = filtered.map((e) => {
        const d = new Date(e.entryDate).toLocaleDateString('ru-RU')
        const parts = []
        if (e.mood != null) parts.push(`настроение ${e.mood}/5`)
        if (e.painScore != null) parts.push(`боль ${e.painScore}/10`)
        if (e.sleepHours != null) parts.push(`сон ${e.sleepHours}ч`)
        const tags = e.tags?.map((t) => t.tag.name).join(', ')
        if (tags) parts.push(`теги: ${tags}`)
        return `• ${d}: ${parts.join(', ')}`
      })
      return {
        functionName: 'get_diary_entries',
        message: `${prefix}Записи дневника:\n${lines.join('\n')}`,
        data: { action: 'diary_filtered', count: filtered.length },
      }
    }
  }

  // ——— Документы: загрузка / OCR ———
  if (intent === 'documents') {
    if (/загруз|ocr|распозна|прикреп/i.test(message)) {
      return {
        functionName: 'document_upload_hint',
        message: `${prefix}В чате нажмите 📎 → **«Загрузить PDF/фото»** (или «Фото» / «PDF» в приложении). Файл попадёт в кабинет, запустится OCR — затем задайте вопрос с прикреплённым документом. Ручные правки — в разделе «Документы».`,
        data: { action: 'upload_hint', link: '/documents' },
      }
    }
  }

  // ——— Только отклонения (medical_question) ———
  if (/только\s+отклонен|выведи\s+отклонен/i.test(message)) {
    const abnormal = await collectUserAbnormalIndicators(patientId)
    return {
      functionName: 'get_analysis_results',
      message: `${prefix}${formatAbnormalIndicatorsForChat(abnormal)}`,
      data: { action: 'abnormal_only', count: abnormal.length },
    }
  }

  return null
}
