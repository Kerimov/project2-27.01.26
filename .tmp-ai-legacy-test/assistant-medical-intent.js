"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGeneralMedicalQuestion = isGeneralMedicalQuestion;
const assistant_diary_intent_1 = require("./assistant-diary-intent");
/** Вопрос о лечении / препаратах — не путать с дневником (температура, боль, симптом). */
function isGeneralMedicalQuestion(message) {
    const t = (0, assistant_diary_intent_1.normAssistantMessage)(message);
    if (!t || (0, assistant_diary_intent_1.isDiaryWriteIntent)(message))
        return false;
    if (/(?:помогает|поможет|можно\s+ли|нужно\s+ли|стоит\s+ли|как\s+принимать|дозировк|сколько\s+раз|противопоказан|побочн|взаимодейств|эффективн|чем\s+лечить|как\s+лечить|что\s+(?:делать|принять|пить)\s+(?:при|от)|от\s+чего|при\s+(?:температур|боли|кашл|насморк|тошнот|головн))/i.test(t)) {
        return true;
    }
    if (/(?:что\s+значит|опасно\s+ли|нормально\s+ли|симптом\s+чего|нужно\s+ли\s+(?:к\s+)?врач)/i.test(t)) {
        return true;
    }
    if (/(?:ибупрофен|парацетамол|нурофен|аспирин|цитрамон|анальгин|но-?шпа|супрастин|омепразол|амоксициллин|азитромицин)/i.test(t) &&
        /(?:\?|помогает|можно|принимать|от\s+|при\s+)/i.test(t)) {
        return true;
    }
    if (/(?:лекарств|препарат|таблетк|медикамент).*(?:помогает|принимать|можно|от\s+)/i.test(t)) {
        return true;
    }
    return false;
}
