/** Распознавание записей в дневник vs запись к врачу (общие глаголы «запиши», «запись»). */

export function normAssistantMessage(input: string) {
  return (input || '').toLowerCase().replace(/ё/g, 'е').trim()
}

export function hasDiaryMetrics(message: string) {
  return /(?:боль|сон|настроен|давлен|пульс|шаг|температур|вес)\s*[:\s]*\d/i.test(message)
}

/** Пользователь хочет добавить запись в дневник (не записаться к врачу). */
export function isDiaryWriteIntent(message: string): boolean {
  const t = normAssistantMessage(message)
  if (!t) return false

  if (
    /(?:запиши|записать|добав(?:ь|ить)?|внеси|отмет|сохран|сделай\s+запись)(?:\s+в)?\s*дневник/i.test(t) ||
    /(?:запись|запис)\s+(?:в\s+)?дневник/i.test(t) ||
    /дневник\s*:/i.test(t)
  ) {
    return true
  }

  if (/(?:добав|запиш|внес|отмет|сохран).*(?:дневник|самочувств)/i.test(t)) {
    return true
  }

  return hasDiaryMetrics(message) && /дневник|сон|боль|настроен/i.test(t)
}

export function isDiaryTopicIntent(message: string): boolean {
  const t = normAssistantMessage(message)
  return /дневник|самочувств|настроен|сон|бол[ьи]|шаг|давлен|пульс|температур|симптом|вес|запис.*дневник/i.test(t)
}

/** Запись на приём к врачу — без ложных срабатываний на «запиши в дневник». */
export function isAppointmentBookingIntent(message: string): boolean {
  const t = normAssistantMessage(message)
  if (!t || isDiaryWriteIntent(message)) return false
  if (/дневник/i.test(t) && !/к\s+врач|на\s+при[её]м|записаться/i.test(t)) return false

  return (
    /записаться/i.test(t) ||
    /(?:запиши|записать)\s+(?:меня\s+)?к\s+(?!дневник\b)/i.test(t) ||
    /(?:запиши|записать)\s+(?:меня\s+)?(?:на\s+)?(?:при[её]м|врач|доктор|специалист)/i.test(t) ||
    /хочу.*при[её]м|свободн.*слот|(?:найди|покажи).*(?:слот|врач).*(?:запис|при[её]м)/i.test(t) ||
    /время.*врач|для записи к врач|на запись к врач/i.test(t) ||
    (/\bслот\b/i.test(t) && /врач|при[её]м|запис/i.test(t))
  )
}
