import { isAnalysisDeepDiveRequest, isAnalysisListOnlyRequest } from './assistant-analysis-intent'
import {
  isAppointmentBookingIntent,
  isDiaryTopicIntent,
  isDiaryWriteIntent,
} from './assistant-diary-intent'
import { isGeneralMedicalQuestion } from './assistant-medical-intent'

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
  | 'analytics'
  | 'caretaker'
  | 'knowledge'
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

/** Убирает приветствие в начале, чтобы «привет! покажи записи» → appointments, а не smalltalk */
export function stripLeadingSmalltalk(input: string): string {
  return input
    .replace(
      /^(?:привет|здравствуй|здорово|добрый\s+(?:день|утро|вечер)|спасибо|благодарю|как\s+дела)[!.?,]?\s*/i,
      ''
    )
    .trim()
}

function isOnlySmalltalk(input: string): boolean {
  const t = norm(input)
  if (!t) return false
  return /^(?:привет|здравствуй|здорово|добрый(?:\s+(?:день|утро|вечер))?|спасибо|благодарю|как\s+дела)[!.?\s]*$/i.test(t)
}

function classifyCoreIntent(t: string): AssistantIntentDecision | null {
  if (/что ты умеешь|помощь|как пользоваться|разделы|возможности|что есть в приложении/i.test(t)) {
    return { intent: 'app_help', confidence: 0.95, reason: 'app help request' }
  }

  if (isDiaryWriteIntent(t)) {
    return { intent: 'diary', confidence: 0.98, reason: 'diary write (priority)' }
  }

  if (isGeneralMedicalQuestion(t)) {
    return { intent: 'medical_question', confidence: 0.93, reason: 'medical advice question (priority)' }
  }

  if (isDiaryTopicIntent(t)) {
    return { intent: 'diary', confidence: 0.92, reason: 'diary topic (priority)' }
  }

  if (isAppointmentBookingIntent(t)) {
    return { intent: 'booking', confidence: 0.95, reason: 'booking request' }
  }

  if (
    /(?:мои|мой|покажи|какие|когда|ближайш|предстоящ).*(?:запис[ьи]|прием|приёма|визит)|(?:запис[ьи]|прием|приёма|визит).*(?:мои|предстоящ|ближайш|к\s+врач)|запис[ьи]\s*(?:к\s+)?врач/i.test(
      t
    )
  ) {
    return { intent: 'appointments', confidence: 0.98, reason: 'patient appointments query' }
  }

  if (/врач|доктор|специалист|терапевт|кардиолог|невролог|эндокринолог|гинеколог|дерматолог/i.test(t)) {
    return { intent: 'doctors', confidence: 0.85, reason: 'doctor search' }
  }

  if (/напоминан|ремайндер|reminder/i.test(t)) {
    return { intent: 'reminders', confidence: 0.95, reason: 'reminders' }
  }

  if (/(?:мои|покажи|список|последн).*(?:документ|файл|загрузк)|(?:документ|файл).*(?:мои|последн)/i.test(t)) {
    return { intent: 'documents', confidence: 0.9, reason: 'documents' }
  }

  if (isAnalysisDeepDiveRequest(t)) {
    return { intent: 'medical_question', confidence: 0.95, reason: 'analysis deep dive (RAG+LLM)' }
  }

  if (isAnalysisListOnlyRequest(t)) {
    return { intent: 'analyses', confidence: 0.92, reason: 'analyses list only' }
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

  if (/kpi|дашборд|аналитик|статистик\s+кабинет|сколько\s+у\s+меня\s+анализ/i.test(t)) {
    return { intent: 'analytics', confidence: 0.9, reason: 'dashboard analytics' }
  }

  if (/куратор|подопечн|связанн.*пациент|для\s+пациента|переключ.*на/i.test(t)) {
    return { intent: 'caretaker', confidence: 0.88, reason: 'caretaker mode' }
  }

  if (/что\s+такое|что\s+означает|референс|натощак|методолог|база\s+знаний/i.test(t) && /ттг|лпнп|срб|ферритин|показател|анализ/i.test(t)) {
    return { intent: 'knowledge', confidence: 0.85, reason: 'knowledge base' }
  }

  if (/медицинск.*отч[её]т|medical_report|сводк.*за\s+период/i.test(t)) {
    return { intent: 'medical_question', confidence: 0.9, reason: 'medical report' }
  }

  if (/сравни.*анализ|triage|срочност.*анализ|создай.*анализ|по\s+категор/i.test(t)) {
    return { intent: 'analyses', confidence: 0.88, reason: 'analyses extended' }
  }

  if (/(?:создай|удали|отмени).*(?:напоминан)|напомни\s+мне/i.test(t)) {
    return { intent: 'reminders', confidence: 0.92, reason: 'reminders write' }
  }

  if (/(?:добав|удали|взаимодейств).*(?:лекарств|препарат)|план\s+при[её]ма/i.test(t)) {
    return { intent: 'medications', confidence: 0.9, reason: 'medications write' }
  }

  if (/(?:отлож|не\s+сделал).*(?:задач)|согласован.*врач/i.test(t)) {
    return { intent: 'care_plan', confidence: 0.88, reason: 'care plan extended' }
  }

  if (/отмени.*(?:запись|при[её]м)|анкет.*(?:визит|при[её]м)|pre-?visit/i.test(t)) {
    return { intent: 'appointments', confidence: 0.9, reason: 'appointments extended' }
  }

  if (/профил|личн.*данн|мой аккаунт/i.test(t)) {
    return { intent: 'profile', confidence: 0.75, reason: 'profile' }
  }

  if (/настройк|уведомлен|аккаунт/i.test(t)) {
    return { intent: 'settings', confidence: 0.75, reason: 'settings' }
  }

  if (/болит|симптом|норма|повышен|понижен|что значит|опасно|лечение|диагноз|анализ|показател|давлен|пульс|температур/i.test(t)) {
    return { intent: 'medical_question', confidence: 0.65, reason: 'medical question' }
  }

  return null
}

export function classifyAssistantIntent(message: string): AssistantIntentDecision {
  const raw = norm(message)
  if (!raw) return { intent: 'unknown', confidence: 0, reason: 'empty' }

  const withoutGreeting = stripLeadingSmalltalk(raw)
  const coreText = withoutGreeting || raw

  const core = classifyCoreIntent(coreText)
  if (core) {
    if (withoutGreeting && /^(?:привет|здравствуй|спасибо)/i.test(raw)) {
      return { ...core, reason: `${core.reason} (after greeting strip)` }
    }
    return core
  }

  if (isOnlySmalltalk(raw)) {
    return { intent: 'smalltalk', confidence: 0.9, reason: 'smalltalk only' }
  }

  return { intent: 'unknown', confidence: 0.35, reason: 'fallback llm' }
}
