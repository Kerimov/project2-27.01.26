"use strict";
/** Распознавание записей в дневник vs запись к врачу (общие глаголы «запиши», «запись»). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normAssistantMessage = normAssistantMessage;
exports.hasDiaryMetrics = hasDiaryMetrics;
exports.isDiaryWriteIntent = isDiaryWriteIntent;
exports.isDiaryTopicIntent = isDiaryTopicIntent;
exports.isAppointmentBookingIntent = isAppointmentBookingIntent;
function normAssistantMessage(input) {
    return (input || '').toLowerCase().replace(/ё/g, 'е').trim();
}
function hasDiaryMetrics(message) {
    return /(?:боль|сон|настроен|давлен|пульс|шаг|температур|вес)\s*[:\s]*\d/i.test(message);
}
/** Пользователь хочет добавить запись в дневник (не записаться к врачу). */
function isDiaryWriteIntent(message) {
    const t = normAssistantMessage(message);
    if (!t)
        return false;
    if (/(?:запиши|записать|добав(?:ь|ить)?|внеси|отмет|сохран|сделай\s+запись)(?:\s+в)?\s*дневник/i.test(t) ||
        /(?:запись|запис)\s+(?:в\s+)?дневник/i.test(t) ||
        /дневник\s*:/i.test(t)) {
        return true;
    }
    if (/(?:добав|запиш|внес|отмет|сохран).*(?:дневник|самочувств)/i.test(t)) {
        return true;
    }
    return hasDiaryMetrics(message) && /дневник|сон|боль|настроен/i.test(t);
}
function isDiaryTopicIntent(message) {
    const t = normAssistantMessage(message);
    if (!t)
        return false;
    if (/дневник|самочувств|запис.*дневник/i.test(t))
        return true;
    if (/(?:покажи|мои|открой|последн|записи|сделай\s+запись).*(?:дневник|самочувств)/i.test(t))
        return true;
    if (/(?:дневник|самочувств).*(?:покажи|записи|запис)/i.test(t))
        return true;
    if (hasDiaryMetrics(message))
        return true;
    if (/(?:запиши|отметь|зафиксируй).*(?:боль|сон|настроен|давлен|пульс|температур|шаг|вес)/i.test(t)) {
        return true;
    }
    if (/обзор|недел|итог|корреляц/i.test(t) && /дневник|сон|боль|настроен/i.test(t))
        return true;
    return false;
}
/** Запись на приём к врачу — без ложных срабатываний на «запиши в дневник». */
function isAppointmentBookingIntent(message) {
    const t = normAssistantMessage(message);
    if (!t || isDiaryWriteIntent(message))
        return false;
    if (/дневник/i.test(t) && !/к\s+врач|на\s+при[её]м|записаться/i.test(t))
        return false;
    return (/записаться/i.test(t) ||
        /(?:запиши|записать)\s+(?:меня\s+)?к\s+(?!дневник\b)/i.test(t) ||
        /(?:запиши|записать)\s+(?:меня\s+)?(?:на\s+)?(?:при[её]м|врач|доктор|специалист)/i.test(t) ||
        /хочу.*при[её]м|свободн.*слот|(?:найди|покажи).*(?:слот|врач).*(?:запис|при[её]м)/i.test(t) ||
        /время.*врач|для записи к врач|на запись к врач/i.test(t) ||
        (/\bслот\b/i.test(t) && /врач|при[её]м|запис/i.test(t)));
}
