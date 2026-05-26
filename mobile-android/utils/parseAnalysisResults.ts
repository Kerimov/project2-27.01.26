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
