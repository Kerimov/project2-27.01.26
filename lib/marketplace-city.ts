/**
 * Нормализация и сопоставление названий городов для маркетплейса.
 * Важно: не использовать «includes» между разными городами (Нижний Новгород ≠ Новгород).
 */

export function normalizeCityKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^г\.?\s*/i, '')
    .replace(/\s+город.*$/i, '')
    .replace(/\s+/g, ' ')
}

/** Каноническое имя города → варианты в БД / от геокодера */
export const CITY_ALIASES: Record<string, string[]> = {
  'москва': ['москва', 'мск'],
  'санкт-петербург': ['санкт-петербург', 'спб', 'петербург', 'ленинград', 'saint petersburg', 'st petersburg'],
  'нижний новгород': ['нижний новгород', 'нижний', 'н. новгород'],
  'ростов-на-дону': ['ростов-на-дону', 'ростов на дону'],
  'набережные челны': ['набережные челны', 'наб. челны'],
  'екатеринбург': ['екатеринбург', 'екб'],
  'новосибирск': ['новосибирск', 'нск'],
  'казань': ['казань'],
  'самара': ['самара'],
  'уфа': ['уфа'],
  'красноярск': ['красноярск'],
  'воронеж': ['воронеж'],
  'пермь': ['пермь'],
  'волгоград': ['волгоград'],
  'краснодар': ['краснодар'],
  'сочи': ['сочи'],
}

/** Геокодер / IP иногда отдают англ. или область — приводим к ключу */
/** Предложный падеж из запроса «в Москве» → ключ */
const PREPOSITIONAL_TO_KEY: Record<string, string> = {
  москве: 'москва',
  'санкт-петербурге': 'санкт-петербург',
  петербурге: 'санкт-петербург',
  спб: 'санкт-петербург',
  казани: 'казань',
  самаре: 'самара',
  уфе: 'уфа',
  екатеринбурге: 'екатеринбург',
  новосибирске: 'новосибирск',
  'нижнем новгороде': 'нижний новгород',
  'ростове-на-дону': 'ростов-на-дону',
  краснодаре: 'краснодар',
  сочи: 'сочи',
  воронеже: 'воронеж',
  перми: 'пермь',
  волгограде: 'волгоград',
  красноярске: 'красноярск',
}

const GEO_INPUT_TO_KEY: Record<string, string> = {
  moscow: 'москва',
  'saint petersburg': 'санкт-петербург',
  'st petersburg': 'санкт-петербург',
  kazan: 'казань',
  'nizhny novgorod': 'нижний новгород',
  'yekaterinburg': 'екатеринбург',
  'novosibirsk': 'новосибирск',
  samara: 'самара',
  'rostov-on-don': 'ростов-на-дону',
  'rostov on don': 'ростов-на-дону',
}

export function resolveCityKey(input: string | null | undefined): string | null {
  if (!input?.trim()) return null
  const key = normalizeCityKey(input)
  if (PREPOSITIONAL_TO_KEY[key]) return PREPOSITIONAL_TO_KEY[key]
  if (GEO_INPUT_TO_KEY[key]) return GEO_INPUT_TO_KEY[key]
  if (CITY_ALIASES[key]) return key
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some((a) => normalizeCityKey(a) === key)) return canonical
  }
  return key
}

/** Варианты для поиска в БД (полные названия, без коротких подстрок вроде «нн» / «нижний») */
export function getCitySearchVariants(city: string): string[] {
  const key = resolveCityKey(city)
  if (!key) return []
  const aliases = CITY_ALIASES[key] || [key]
  const variants = new Set<string>()
  for (const a of aliases) {
    const n = normalizeCityKey(a)
    if (n.length >= 4) variants.add(n)
  }
  const display = key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  variants.add(normalizeCityKey(display))
  variants.add(normalizeCityKey(key))
  return Array.from(variants)
}

export function citiesMatch(companyCity: string | null | undefined, filterCity: string | null | undefined): boolean {
  if (!filterCity?.trim()) return true
  if (!companyCity?.trim()) return false
  const filterKey = resolveCityKey(filterCity)
  const companyKey = resolveCityKey(companyCity)
  if (!filterKey || !companyKey) return false
  if (filterKey === companyKey) return true
  const filterVariants = getCitySearchVariants(filterCity)
  const companyNorm = normalizeCityKey(companyCity)
  return filterVariants.some((v) => normalizeCityKey(v) === companyNorm)
}

/**
 * Сопоставить определённый город со списком из БД (точное совпадение + алиасы, без ложных includes).
 */
export function matchCityFromList(
  detected: string,
  availableCities: string[]
): string | null {
  const detectedKey = resolveCityKey(detected)
  if (!detectedKey) return null

  for (const c of availableCities) {
    const cKey = resolveCityKey(c)
    if (cKey && cKey === detectedKey) return c
  }

  const variants = getCitySearchVariants(detected)
  for (const c of availableCities) {
    const cNorm = normalizeCityKey(c)
    if (variants.some((v) => normalizeCityKey(v) === cNorm)) return c
  }

  return null
}

/** Красивое отображаемое имя по ключу */
export function formatCityLabel(city: string): string {
  const key = resolveCityKey(city) || city
  return key
    .split(' ')
    .map((w) => (w.length <= 3 && w.includes('-') ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
