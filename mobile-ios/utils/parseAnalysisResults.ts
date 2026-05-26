export type ParsedIndicator = {
  name: string;
  value: string | number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  reference?: string;
  isNormal?: boolean;
  flag?: string;
};

const META_KEYS = new Set(['findings', 'rawTextLength', 'indicators']);

function normalizeIndicator(ind: Record<string, unknown>, fallbackName: string): ParsedIndicator {
  const isNormal =
    ind.isNormal !== undefined && ind.isNormal !== null
      ? Boolean(ind.isNormal)
      : ind.normal !== undefined && ind.normal !== null
        ? Boolean(ind.normal)
        : undefined;

  return {
    name: String(ind.name || fallbackName),
    value: ind.value !== undefined && ind.value !== null ? (ind.value as string | number) : '',
    unit: ind.unit ? String(ind.unit) : undefined,
    referenceMin: typeof ind.referenceMin === 'number' ? ind.referenceMin : undefined,
    referenceMax: typeof ind.referenceMax === 'number' ? ind.referenceMax : undefined,
    reference: ind.reference ? String(ind.reference) : undefined,
    isNormal,
    flag: ind.flag ? String(ind.flag) : undefined,
  };
}

function normalizeList(arr: unknown[]): ParsedIndicator[] {
  return arr
    .filter((x) => x && typeof x === 'object')
    .map((raw, idx) => normalizeIndicator(raw as Record<string, unknown>, `Показатель ${idx + 1}`));
}

/** Парсит results анализа так же, как веб (indicators[] или объект {название: {value, unit, normal}}) */
export function parseAnalysisIndicators(results: unknown): ParsedIndicator[] {
  let parsed: unknown = results;

  if (typeof results === 'string') {
    try {
      parsed = JSON.parse(results);
    } catch {
      return [];
    }
  }

  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    if (
      parsed.length > 0 &&
      typeof parsed[0] === 'object' &&
      parsed[0] !== null &&
      'indicators' in (parsed[0] as object)
    ) {
      const nested = (parsed[0] as { indicators?: unknown }).indicators;
      return Array.isArray(nested) ? normalizeList(nested) : [];
    }
    return normalizeList(parsed);
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    if (Array.isArray(obj.indicators)) {
      return normalizeList(obj.indicators);
    }

    const keys = Object.keys(obj).filter((k) => !META_KEYS.has(k));
    if (keys.length > 0) {
      const first = obj[keys[0]];
      if (first && typeof first === 'object' && 'value' in (first as object)) {
        return keys.map((name) =>
          normalizeIndicator({ name, ...(obj[name] as Record<string, unknown>) }, name)
        );
      }
    }
  }

  return [];
}

export function extractAiComments(notes?: string | null): string | null {
  if (!notes) return null;
  const marker = '--- AI Комментарии ---';
  if (!notes.includes(marker)) return null;
  const part = notes.split(marker)[1];
  return part?.trim() || null;
}

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const v = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

export function getNumericIndicatorNames(results: unknown): string[] {
  return parseAnalysisIndicators(results)
    .filter((ind) => toNumeric(ind.value) !== null)
    .map((ind) => ind.name);
}

export function getCommonNumericIndicators(analyses: Array<{ results: unknown }>): string[] {
  if (analyses.length === 0) return [];
  const perAnalysis = analyses.map((a) => new Set(getNumericIndicatorNames(a.results)));
  const [first, ...rest] = perAnalysis;
  const common = [...first].filter((name) => rest.every((set) => set.has(name)));
  return common.sort((a, b) => a.localeCompare(b, 'ru'));
}

type IndicatorKey = 'glucose' | 'hemoglobin' | 'cholesterol_total' | 'creatinine' | 'alt' | 'ast' | string;

const KEY_LABELS: Record<string, string> = {
  glucose: 'Глюкоза',
  hemoglobin: 'Гемоглобин',
  cholesterol_total: 'Холестерин общий',
  ldl: 'ЛПНП (LDL)',
  hdl: 'ЛПВП (HDL)',
  triglycerides: 'Триглицериды',
  creatinine: 'Креатинин',
  uric_acid: 'Мочевая кислота',
  crp: 'С-реактивный белок (CRP)',
  tsh: 'ТТГ (TSH)',
  vitamin_d: 'Витамин D (25-OH)',
  ferritin: 'Ферритин',
  wbc: 'Лейкоциты (WBC)',
  rbc: 'Эритроциты (RBC)',
  platelets: 'Тромбоциты (PLT)',
  hematocrit: 'Гематокрит (HCT)',
  alt: 'АЛТ (ALT)',
  ast: 'АСТ (AST)',
};

function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s./+-]/gu, '');
}

function normalizeUnit(unit?: string): string {
  return normalizeText(unit || '').replace(/\s+/g, '');
}

export function indicatorKeyFromName(name: string): IndicatorKey {
  const n = normalizeText(name).replace(/\s+/g, '');
  if (/(^|[^a-z])glu($|[^a-z])/.test(n) || n.includes('glucose') || n.includes('глюкоз')) return 'glucose';
  if (
    /(^|[^a-z])hgb($|[^a-z])/.test(n) ||
    /(^|[^a-z])hb($|[^a-z])/.test(n) ||
    n.includes('hemoglobin') ||
    n.includes('гемоглобин')
  )
    return 'hemoglobin';
  if (n.includes('ldl') || n.includes('лпнп') || n.includes('липопротеинниз')) return 'ldl';
  if (n.includes('hdl') || n.includes('лпвп') || n.includes('липопротеинвыс')) return 'hdl';
  if (n.includes('triglycerid') || n.includes('триглицер')) return 'triglycerides';
  if (n.includes('cholesterol') || n.includes('холестерин') || n.includes('холест')) return 'cholesterol_total';
  if (n.includes('creatinine') || n.includes('креатинин')) return 'creatinine';
  if (n.includes('uricacid') || n.includes('uric') || (n.includes('мочев') && n.includes('кисл'))) return 'uric_acid';
  if (/(^|[^a-z])crp($|[^a-z])/.test(n) || n.includes('c-reactive') || n.includes('среактив')) return 'crp';
  if (/(^|[^a-z])tsh($|[^a-z])/.test(n) || n.includes('ттг') || n.includes('тиреотроп')) return 'tsh';
  if (n.includes('25oh') || n.includes('25(oh)') || n.includes('vitamind') || (n.includes('витамин') && n.includes('d')))
    return 'vitamin_d';
  if (n.includes('ferritin') || n.includes('ферритин')) return 'ferritin';
  if (/(^|[^a-z])wbc($|[^a-z])/.test(n) || n.includes('лейкоц')) return 'wbc';
  if (/(^|[^a-z])rbc($|[^a-z])/.test(n) || n.includes('эритроц')) return 'rbc';
  if (n.includes('plt') || n.includes('platelet') || n.includes('тромбоц')) return 'platelets';
  if (n.includes('hct') || n.includes('hematocrit') || n.includes('гематокрит')) return 'hematocrit';
  if (/(^|[^a-z])alt($|[^a-z])/.test(n) || n.includes('алат') || n.includes('алт')) return 'alt';
  if (/(^|[^a-z])ast($|[^a-z])/.test(n) || n.includes('асат') || n.includes('аст')) return 'ast';
  return n;
}

export type CommonIndicatorGroup = {
  key: IndicatorKey;
  label: string;
  variants: string[];
};

export function getCommonIndicatorGroups(analyses: Array<{ results: unknown }>): CommonIndicatorGroup[] {
  if (analyses.length === 0) return [];
  const per = analyses.map((a) => {
    const inds = parseAnalysisIndicators(a.results);
    const numeric = inds.filter((ind) => toNumeric(ind.value) !== null);
    const map = new Map<IndicatorKey, string[]>();
    for (const ind of numeric) {
      const key = indicatorKeyFromName(ind.name);
      const arr = map.get(key) || [];
      arr.push(ind.name);
      map.set(key, arr);
    }
    return map;
  });

  const keys0 = new Set(per[0].keys());
  const commonKeys = [...keys0].filter((k) => per.slice(1).every((m) => m.has(k)));
  return commonKeys
    .map((key) => {
      const variants = new Set<string>();
      for (const m of per) for (const n of m.get(key) || []) variants.add(n);
      return {
        key,
        label: KEY_LABELS[key] || [...variants][0] || String(key),
        variants: [...variants].sort((a, b) => a.localeCompare(b, 'ru')),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

export function convertValueToCanonicalUnit(
  key: IndicatorKey,
  value: number,
  unit?: string
): { value: number; unit?: string; warning?: string } {
  const u = normalizeUnit(unit);
  if (!u) return { value, unit, warning: 'Единицы не указаны' };

  if (key === 'glucose') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' };
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 18, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' };
    return { value, unit, warning: `Неизвестные единицы для глюкозы: ${unit}` };
  }

  if (key === 'cholesterol_total') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' };
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 38.67, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' };
    return { value, unit, warning: `Неизвестные единицы для холестерина: ${unit}` };
  }

  if (key === 'ldl' || key === 'hdl') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' };
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 38.67, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' };
    return { value, unit, warning: `Неизвестные единицы для липидов: ${unit}` };
  }

  if (key === 'triglycerides') {
    if (u === 'ммоль/л' || u === 'mmol/l') return { value, unit: 'ммоль/л' };
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value / 88.57, unit: 'ммоль/л', warning: 'Конвертация из mg/dL в mmol/L' };
    return { value, unit, warning: `Неизвестные единицы для триглицеридов: ${unit}` };
  }

  if (key === 'creatinine') {
    if (u === 'мкмоль/л' || u === 'umol/l' || u === 'µmol/l') return { value, unit: 'мкмоль/л' };
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value * 88.4, unit: 'мкмоль/л', warning: 'Конвертация из mg/dL в µmol/L' };
    return { value, unit, warning: `Неизвестные единицы для креатинина: ${unit}` };
  }

  if (key === 'uric_acid') {
    if (u === 'мкмоль/л' || u === 'umol/l' || u === 'µmol/l') return { value, unit: 'мкмоль/л' };
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value * 59.48, unit: 'мкмоль/л', warning: 'Конвертация из mg/dL в µmol/L' };
    return { value, unit, warning: `Неизвестные единицы для мочевой кислоты: ${unit}` };
  }

  if (key === 'hemoglobin') {
    if (u === 'г/л' || u === 'g/l') return { value, unit: 'г/л' };
    if (u === 'г/дл' || u === 'g/dl') return { value: value * 10, unit: 'г/л', warning: 'Конвертация из g/dL в g/L' };
    return { value, unit, warning: `Неизвестные единицы для гемоглобина: ${unit}` };
  }

  if (key === 'crp') {
    if (u === 'мг/л' || u === 'mg/l') return { value, unit: 'мг/л' };
    if (u === 'мг/дл' || u === 'mg/dl') return { value: value * 10, unit: 'мг/л', warning: 'Конвертация из mg/dL в mg/L' };
    return { value, unit, warning: `Неизвестные единицы для CRP: ${unit}` };
  }

  if (key === 'vitamin_d') {
    if (u === 'нмоль/л' || u === 'nmol/l') return { value, unit: 'нмоль/л' };
    if (u === 'нг/мл' || u === 'ng/ml') return { value: value * 2.5, unit: 'нмоль/л', warning: 'Конвертация из ng/mL в nmol/L' };
    return { value, unit, warning: `Неизвестные единицы для витамина D: ${unit}` };
  }

  if (key === 'ferritin') {
    if (u === 'мкг/л' || u === 'µg/l' || u === 'ug/l') return { value, unit: 'мкг/л' };
    if (u === 'нг/мл' || u === 'ng/ml') return { value, unit: 'мкг/л', warning: 'Нормализация единиц (ng/mL ≡ µg/L)' };
    return { value, unit, warning: `Неизвестные единицы для ферритина: ${unit}` };
  }

  if (key === 'tsh') {
    if (u === 'мме/л' || u === 'miu/l' || u === 'мед/л' || u === 'mu/l') return { value, unit: 'мМЕ/л' };
    return { value, unit, warning: `Единицы для ТТГ могут отличаться: ${unit}` };
  }

  return { value, unit };
}

function tokenSet(s: string): Set<string> {
  const t = normalizeText(s)
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 3);
  return new Set(t);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function similarityName(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  const ta = tokenSet(na);
  const tb = tokenSet(nb);
  return jaccard(ta, tb);
}

export type ProbableIndicatorGroup = {
  key: string;
  label: string;
  confidence: number; // 0..1
  variants: string[];
  perAnalysisNameByIndex: Record<number, string>;
  warnings: string[];
};

export function suggestProbableCommonGroups(
  analyses: Array<{ results: unknown }>,
  opts?: { minConfidence?: number; limit?: number }
): ProbableIndicatorGroup[] {
  const minConfidence = opts?.minConfidence ?? 0.66;
  const limit = opts?.limit ?? 8;
  if (analyses.length < 2) return [];

  const perAnalysisNames = analyses.map((a) => {
    const inds = parseAnalysisIndicators(a.results);
    return inds
      .filter((ind) => toNumeric(ind.value) !== null)
      .map((ind) => ind.name);
  });

  const seeds = perAnalysisNames[0] || [];
  const usedByAnalysis = perAnalysisNames.map(() => new Set<string>());
  const out: ProbableIndicatorGroup[] = [];

  for (const seed of seeds) {
    const per: Record<number, string> = { 0: seed };
    let confSum = 0;
    let ok = true;
    for (let i = 1; i < perAnalysisNames.length; i++) {
      const candidates = perAnalysisNames[i].filter((n) => !usedByAnalysis[i].has(n));
      let bestName = '';
      let bestScore = 0;
      for (const c of candidates) {
        const s = similarityName(seed, c);
        if (s > bestScore) {
          bestScore = s;
          bestName = c;
        }
      }
      if (!bestName || bestScore < minConfidence) {
        ok = false;
        break;
      }
      per[i] = bestName;
      confSum += bestScore;
    }
    if (!ok) continue;

    const avg = confSum / Math.max(1, perAnalysisNames.length - 1);
    for (const [idx, name] of Object.entries(per)) usedByAnalysis[Number(idx)].add(name);
    const variants = Object.values(per);
    const key = `prob:${normalizeText(seed).replace(/\s+/g, '_').slice(0, 60)}`;
    out.push({
      key,
      label: variants[0],
      confidence: Math.max(0, Math.min(1, avg)),
      variants: [...new Set(variants)].sort((a, b) => a.localeCompare(b, 'ru')),
      perAnalysisNameByIndex: per,
      warnings: ['Вероятное совпадение по названию. Проверьте, что это один и тот же показатель.'],
    });
    if (out.length >= limit) break;
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}
