export type AssistantIntent =
  | 'appointments'
  | 'booking'
  | 'doctors'
  | 'reminders'
  | 'documents'
  | 'analyses'
  | 'diary'
  | 'medications'
  | 'care_plan'
  | 'marketplace'
  | 'profile'
  | 'settings'
  | 'app_help'
  | 'medical_question'
  | 'smalltalk'
  | 'unknown'

export type AssistantIntentDecision = {
  intent: AssistantIntent
  confidence: number
  reason: string
}

function norm(input: string) {
  return (input || '').toLowerCase().replace(/ё/g, 'е').trim()
}

export function classifyAssistantIntent(message: string): AssistantIntentDecision {
  const t = norm(message)

  if (!t) return { intent: 'unknown', confidence: 0, reason: 'empty' }

  if (/^(привет|здравствуй|добрый день|добрый вечер|спасибо|благодарю|как дела)/i.test(t)) {
    return { intent: 'smalltalk', confidence: 0.9, reason: 'smalltalk phrase' }
  }

  if (/что ты умеешь|помощь|как пользоваться|разделы|возможности|что есть в приложении/i.test(t)) {
    return { intent: 'app_help', confidence: 0.95, reason: 'app help request' }
  }

  if (/записаться|запиши|записать|хочу.*прием|свободн.*слот|слот|время.*врач|для записи к врач|на запись к врач/i.test(t)) {
    return { intent: 'booking', confidence: 0.95, reason: 'booking request' }
  }

  if (/(?:мои|мой|покажи|какие|когда|ближайш|предстоящ).*(?:запис[ьи]?|прием[ы]?|прием[ы]?)|(?:запис[ьи]?|прием[ы]?).*(?:мои|предстоящ|ближайш)/i.test(t)) {
    return { intent: 'appointments', confidence: 0.98, reason: 'patient appointments query' }
  }

  if (/врач|доктор|специалист|терапевт|кардиолог|невролог|эндокринолог|гинеколог|дерматолог/i.test(t)) {
    return { intent: 'doctors', confidence: 0.85, reason: 'doctor search' }
  }

  if (/напоминан|ремайндер|reminder/i.test(t)) return { intent: 'reminders', confidence: 0.95, reason: 'reminders' }
  if (/(?:мои|покажи|список|последн).*(?:документ|файл|загрузк)|(?:документ|файл).*(?:мои|последн)/i.test(t)) {
    return { intent: 'documents', confidence: 0.9, reason: 'documents' }
  }
  if (/(?:мои|покажи|список|последн).*(?:анализ|показател)|(?:анализ|показател).*(?:мои|последн)/i.test(t)) {
    return { intent: 'analyses', confidence: 0.92, reason: 'analyses list' }
  }
  if (/дневник|самочувств|настроен|сон|боль|боли|шаг|давлен|пульс|температур|симптом|вес|запис.*дневник/i.test(t)) {
    return { intent: 'diary', confidence: 0.9, reason: 'diary' }
  }
  if (/лекарств|препарат|таблетк|бад|медикамент|что принимаю|список.*лекарств|расписан.*прием/i.test(t)) {
    return { intent: 'medications', confidence: 0.9, reason: 'medications' }
  }
  if (/план действий|мои задачи|задач|активн.*задач|отложен|выполнен|согласован|что сделать|следующ.*шаг/i.test(t)) {
    if (!/планов.*прием|плановый осмотр|запис.*врач|слот|прием к|к врачу/i.test(t)) {
      return { intent: 'care_plan', confidence: 0.9, reason: 'care plan' }
    }
  }
  if (/маркетплейс|клиник|лаборатор|аптек|найди.*клиник|поиск.*клиник/i.test(t)) {
    return { intent: 'marketplace', confidence: 0.8, reason: 'marketplace' }
  }
  if (/профил|личн.*данн|мой аккаунт/i.test(t)) return { intent: 'profile', confidence: 0.75, reason: 'profile' }
  if (/настройк|уведомлен|аккаунт/i.test(t)) return { intent: 'settings', confidence: 0.75, reason: 'settings' }

  if (/болит|симптом|норма|повышен|понижен|что значит|опасно|лечение|диагноз|анализ|показател|давлен|пульс|температур/i.test(t)) {
    return { intent: 'medical_question', confidence: 0.65, reason: 'medical question' }
  }

  return { intent: 'unknown', confidence: 0.35, reason: 'fallback llm' }
}
