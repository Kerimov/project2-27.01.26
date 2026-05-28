"use strict";
/** Различение «список анализов» vs «разбор / отклонения» для маршрутизации чата */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnalysisDeepDiveRequest = isAnalysisDeepDiveRequest;
exports.isAnalysisListOnlyRequest = isAnalysisListOnlyRequest;
exports.shouldBypassProjectActionShortcut = shouldBypassProjectActionShortcut;
function norm(input) {
    return (input || '').toLowerCase().replace(/ё/g, 'е').trim();
}
/** Запрос на интерпретацию, отклонения, динамику — нужен RAG + LLM по данным ЛК */
function isAnalysisDeepDiveRequest(message) {
    const t = norm(message);
    if (!t)
        return false;
    if (/отклон|вне\s*норм|не\s*в\s*норм|выше\s*норм|ниже\s*норм|повышен|понижен|критич|abnormal|critical/i.test(t)) {
        return true;
    }
    if (/разбор|интерпрет|объясни|расшифр|прокоммент|оцени|расшифруй|проанализируй|что\s+значит|что\s+означает/i.test(t) &&
        /анализ|показател|лабор|результат|кров|моч/i.test(t)) {
        return true;
    }
    if (/динамик|тренд|сравн|изменил|изменени/i.test(t) && /анализ|показател/i.test(t)) {
        return true;
    }
    if (/что\s+не\s+так|насколько\s+опасн|нужно\s+ли\s+волнов|обратиться/i.test(t) && /анализ|показател/i.test(t)) {
        return true;
    }
    return false;
}
/** Только перечислить анализы (дата, название) — можно shortcut-списком */
function isAnalysisListOnlyRequest(message) {
    const t = norm(message);
    if (!t || isAnalysisDeepDiveRequest(message))
        return false;
    if (/показател|отклон|разбор|интерпрет|вне\s*норм|динамик|тренд/i.test(t)) {
        return false;
    }
    return (/^(?:покажи|выведи|список|какие|мои|последние)\s+(?:мои\s+)?анализ/i.test(t) ||
        /^(?:мои|список)\s+анализ/i.test(t) ||
        /^(?:какие|сколько)\s+у\s+меня\s+анализ/i.test(t) ||
        (/анализ/i.test(t) && /список|перечень|все\s+мои/i.test(t)));
}
/** Shortcut-интенты (запись, списки) не должны блокировать RAG для мед. вопросов */
function shouldBypassProjectActionShortcut(intent, message) {
    if (isAnalysisDeepDiveRequest(message))
        return true;
    if (intent === 'medical_question')
        return true;
    if (intent === 'unknown' && /анализ|показател|отклон|лабор|результат/i.test(norm(message))) {
        return true;
    }
    if (intent === 'analyses' && !isAnalysisListOnlyRequest(message)) {
        return true;
    }
    return false;
}
