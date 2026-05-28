import { isDiaryWriteIntent, isDiaryTopicIntent } from './assistant-diary-intent'
import { isAppointmentBookingIntent } from './assistant-diary-intent'

export function isCarePlanIntent(message: string) {
  const t = (message || '').toLowerCase()
  return (
    /план|пошагов|что делать дальше|следующие шаги|напоминан|reminder|задач/i.test(t) &&
    !/не делай|не создавай|без напоминаний/i.test(t)
  )
}

export function isYesIntent(message: string) {
  return /^(да|ага|ок|okay|yes|подтверждаю|запиши|давай|согласен|согласна)([.! ]|$)/i.test(message.trim())
}

export function isNoIntent(message: string) {
  return /^(нет|не надо|отмена|отмени|cancel|стоп)([.! ]|$)/i.test(message.trim())
}

function isAppointmentQueryIntent(message: string) {
  const t = message.toLowerCase()
  if (/записаться|запиши|записать|найди.*врач|покажи.*врач|свободн.*слот|хочу.*при[её]м/i.test(t)) return false
  return (
    /(?:мои|мой|покажи|какие|когда|ближайш|предстоящ).*(?:запис[ьи]?|при[её]м[ы]?)/i.test(t) ||
    /(?:запис[ьи]?|при[её]м[ы]?).*(?:мои|предстоящ|ближайш)/i.test(t)
  )
}

export function isDoctorIntent(message: string) {
  if (
    isAppointmentQueryIntent(message) ||
    isDiaryTopicIntent(message) ||
    isMedicationsIntent(message) ||
    isCarePlanTasksIntent(message) ||
    isReminderIntent(message) ||
    isDocumentsIntent(message) ||
    isAnalysesListIntent(message)
  ) {
    return false
  }
  return /врач|доктор|специалист|терапевт|кардиолог|невролог|эндокринолог|при[её]м|запис/i.test(message)
}

export function isBookingIntent(message: string) {
  if (isDiaryWriteIntent(message)) return false
  return isAppointmentBookingIntent(message)
}

export function isReminderIntent(message: string) {
  return /напоминан|ремайндер|reminder/i.test(message)
}

export function isDocumentsIntent(message: string) {
  return /(?:мои|покажи|список|последн).*(?:документ|файл|загрузк)|(?:документ|файл).*(?:мои|последн)/i.test(message)
}

export function isAnalysesListIntent(message: string) {
  return /(?:мои|покажи|список|последн).*(?:анализ|показател)|(?:анализ|показател).*(?:мои|последн)/i.test(message)
}

export function isMedicationsIntent(message: string) {
  return (
    /лекарств|препарат|таблетк|бад|медикамент|что принимаю|список.*лекарств|расписан.*при[её]м/i.test(message) &&
    !/рекомендац|совет.*леч/i.test(message)
  )
}

export function isCarePlanTasksIntent(message: string) {
  const t = (message || '').toLowerCase()
  if (/планов.*при[её]м|плановый осмотр/i.test(t)) return false
  return (
    /план действий|мои задачи|задач|активн.*задач|отложен|выполнен|согласован|что сделать|следующ.*шаг/i.test(t) &&
    !/планов.*при[её]м|плановый осмотр/i.test(t)
  )
}

export function isAddCarePlanTaskIntent(message: string) {
  return /(?:добав|создай|новая)\s+задач/i.test(message) || /задач[ау]:\s*\S/i.test(message)
}

export function isAddDiaryIntent(message: string) {
  return isDiaryWriteIntent(message)
}

export function isDiaryReviewIntent(message: string) {
  return /обзор|недел|итог|что влияло|корреляц/i.test(message) && isDiaryTopicIntent(message)
}
