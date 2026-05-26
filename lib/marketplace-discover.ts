import { CompanyType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { filterFallbackCompanies } from '@/lib/marketplace-fallback'
import { citiesMatch, formatCityLabel } from '@/lib/marketplace-city'
import { callOllamaChat, isOllamaConfigured } from '@/lib/ollama'
import { isDeepSeekConfigured, callDeepSeekChat } from '@/lib/deepseek'

export type DiscoveredCompany = {
  id: string
  name: string
  type: string
  description?: string
  address?: string
  city?: string
  phone?: string
  website?: string
  rating?: number
  reviewCount: number
  isVerified: boolean
  source: 'catalog' | 'openstreetmap' | 'web'
  sourceUrl?: string
  snippet?: string
}

export type MarketplaceSearchIntent = {
  query: string
  city?: string | null
  type?: string | null
  specialization?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  CLINIC: 'Клиника',
  LABORATORY: 'Лаборатория',
  PHARMACY: 'Аптека',
  HEALTH_STORE: 'Магазин здорового питания',
  FITNESS_CENTER: 'Фитнес-центр',
  NUTRITIONIST: 'Диетолог',
  OTHER: 'Другое',
}

function hashId(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Частичный поиск: подстрока или совпадение хотя бы одного слова запроса (от 2 символов). */
export function matchesCompanySearch(haystack: string, query: string): boolean {
  const cleaned = query.replace(/найди|покажи|подбери|ищу|клиник[аи]?/gi, ' ').trim()
  const q = normalizeSearchText(cleaned)
  if (!q) return true

  const hay = normalizeSearchText(haystack)
  if (hay.includes(q)) return true

  const tokens = q.split(' ').filter((t) => t.length >= 2)
  if (tokens.length === 0) return true
  return tokens.some((token) => hay.includes(token))
}

function searchTokens(query: string) {
  return normalizeSearchText(query.replace(/найди|покажи|подбери|ищу|клиник[аи]?/gi, ' '))
    .split(' ')
    .filter((t) => t.length >= 2)
}

export function parseMarketplaceIntent(message: string, cityHint?: string | null): MarketplaceSearchIntent {
  const text = message.trim()
  const lower = text.toLowerCase()

  let type: string | null = null
  if (/лаборатор|анализ|invitro|гемотест|сдать кровь/i.test(lower)) type = 'LABORATORY'
  else if (/аптек/i.test(lower)) type = 'PHARMACY'
  else if (/стоматолог|зуб/i.test(lower)) type = 'CLINIC'
  else if (/клиник|поликлиник|медцентр|госпитал|врач|при[её]м|узи|мрт|кт/i.test(lower)) type = 'CLINIC'

  let specialization: string | null = null
  if (/терапевт|семейн/i.test(lower)) specialization = 'терапевт'
  else if (/кардиолог|сердц/i.test(lower)) specialization = 'кардиолог'
  else if (/невролог/i.test(lower)) specialization = 'невролог'
  else if (/гинеколог/i.test(lower)) specialization = 'гинеколог'
  else if (/стоматолог|зуб/i.test(lower)) specialization = 'стоматолог'
  else if (/эндокринолог|диабет|гормон/i.test(lower)) specialization = 'эндокринолог'
  else if (/дерматолог|кож/i.test(lower)) specialization = 'дерматолог'

  let city = cityHint?.trim() ? formatCityLabel(cityHint.trim()) : null
  const cityMatch = text.match(/(?:в|город(?:е)?)\s+([А-ЯЁA-Z][а-яёa-z\-]+(?:\s+[А-ЯЁA-Z][а-яёa-z\-]+)?)/i)
  if (cityMatch?.[1]) city = formatCityLabel(cityMatch[1].trim())

  return { query: text, city, type, specialization }
}

function buildWebSearchQuery(intent: MarketplaceSearchIntent) {
  const parts = ['медицинская клиника']
  if (intent.type === 'LABORATORY') parts[0] = 'медицинская лаборатория анализы'
  if (intent.specialization) parts.push(intent.specialization)
  if (intent.city) parts.push(intent.city)
  if (intent.query) parts.push(intent.query.replace(/найди|покажи|подбери|ищу|клиник[аи]?/gi, '').trim())
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&accept-language=ru&q=${encodeURIComponent(city)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PMA-Medical-Assistant/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const first = Array.isArray(data) ? data[0] : null
    if (!first?.lat || !first?.lon) return null
    return {
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      displayName: first.display_name || city,
    }
  } catch {
    return null
  }
}

async function searchOpenStreetMap(intent: MarketplaceSearchIntent, limit = 12): Promise<DiscoveredCompany[]> {
  if (!intent.city) return []
  const geo = await geocodeCity(intent.city)
  if (!geo) return []

  const query = `
[out:json][timeout:15];
(
  node["amenity"~"clinic|doctors|hospital|healthcare"](around:20000,${geo.lat},${geo.lon});
  way["amenity"~"clinic|doctors|hospital|healthcare"](around:20000,${geo.lat},${geo.lon});
  node["healthcare"](around:20000,${geo.lat},${geo.lon});
  way["healthcare"](around:20000,${geo.lat},${geo.lon});
);
out center ${limit};
`

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const elements = Array.isArray(data?.elements) ? data.elements : []

    return elements
      .map((el: any) => {
        const tags = el.tags || {}
        const name = tags.name || tags['name:ru'] || tags.operator
        if (!name) return null
        const lat = el.lat ?? el.center?.lat
        const lon = el.lon ?? el.center?.lon
        const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || tags['addr:full'] || undefined
        const amenity = tags.amenity || tags.healthcare || 'clinic'
        const type = amenity === 'hospital' || amenity === 'clinic' ? 'CLINIC' : intent.type || 'CLINIC'
        const website = tags.website || tags['contact:website'] || undefined
        const phone = tags.phone || tags['contact:phone'] || undefined
        const id = `osm:${el.type}:${el.id}`
        return {
          id,
          name: String(name),
          type,
          description: `Данные OpenStreetMap (${TYPE_LABELS[type] || type})`,
          address: address || undefined,
          city: intent.city || undefined,
          phone: phone || undefined,
          website: website || (lat && lon ? `https://www.openstreetmap.org/${el.type}/${el.id}` : undefined),
          reviewCount: 0,
          isVerified: false,
          source: 'openstreetmap' as const,
          sourceUrl: lat && lon ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}` : undefined,
        }
      })
      .filter(Boolean) as DiscoveredCompany[]
  } catch {
    return []
  }
}

function decodeDdgRedirect(href: string) {
  try {
    if (href.includes('uddg=')) {
      const u = new URL(href, 'https://duckduckgo.com')
      return decodeURIComponent(u.searchParams.get('uddg') || href)
    }
    return href
  } catch {
    return href
  }
}

function parseDdgHtml(html: string, intent: MarketplaceSearchIntent, limit: number): DiscoveredCompany[] {
  const results: DiscoveredCompany[] = []
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
  const links: Array<{ url: string; title: string }> = []
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(html)) !== null && links.length < limit) {
    const url = decodeDdgRedirect(m[1])
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (title && url.startsWith('http')) links.push({ url, title })
  }
  const snippets: string[] = []
  while ((m = snippetRegex.exec(html)) !== null && snippets.length < limit) {
    snippets.push(m[1].replace(/<[^>]+>/g, '').trim())
  }

  for (let i = 0; i < links.length; i++) {
    const { url, title } = links[i]
    if (/wikipedia|youtube|facebook|vk\.com|instagram|avito|ozon|wildberries/i.test(url)) continue
    results.push({
      id: `web:${hashId(url)}`,
      name: title,
      type: intent.type || 'CLINIC',
      description: snippets[i] || 'Найдено в открытых источниках в интернете',
      city: intent.city || undefined,
      website: url,
      reviewCount: 0,
      isVerified: false,
      source: 'web',
      sourceUrl: url,
      snippet: snippets[i],
    })
  }
  return results
}

async function searchWeb(intent: MarketplaceSearchIntent, limit = 8): Promise<DiscoveredCompany[]> {
  const q = buildWebSearchQuery(intent)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; PMA-Medical-Assistant/1.0; +https://pma.health)',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'ru-RU,ru;q=0.9',
  }

  const attempts: Array<() => Promise<string | null>> = [
    async () => {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        headers,
        signal: AbortSignal.timeout(12000),
      })
      return res.ok ? await res.text() : null
    },
    async () => {
      const res = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ q }),
        signal: AbortSignal.timeout(12000),
      })
      return res.ok ? await res.text() : null
    },
    async () => {
      const res = await fetch('https://lite.duckduckgo.com/lite/', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ q }),
        signal: AbortSignal.timeout(12000),
      })
      return res.ok ? await res.text() : null
    },
  ]

  for (const attempt of attempts) {
    try {
      const html = await attempt()
      if (!html) continue
      const parsed = parseDdgHtml(html, intent, limit)
      if (parsed.length > 0) return parsed
    } catch {
      /* try next */
    }
  }
  return []
}

/** Поиск организаций по названию через Nominatim (дополнение к Overpass и веб-поиску). */
async function searchNominatimPlaces(intent: MarketplaceSearchIntent, limit = 10): Promise<DiscoveredCompany[]> {
  const parts = [
    intent.specialization,
    intent.type === 'LABORATORY' ? 'медицинская лаборатория' : 'медицинская клиника',
    intent.city,
    intent.query.replace(/найди|покажи|подбери|ищу|клиник[аи]?/gi, '').trim(),
  ].filter(Boolean)
  const q = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (q.length < 3) return []

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&countrycodes=ru&accept-language=ru&q=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PMA-Medical-Assistant/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []

    return data
      .map((item: any) => {
        const name = String(item.display_name || '').split(',')[0]?.trim()
        if (!name || name.length < 3) return null
        const type = intent.type || 'CLINIC'
        const lat = item.lat ? parseFloat(item.lat) : null
        const lon = item.lon ? parseFloat(item.lon) : null
        const id = `osm:nominatim:${item.osm_type || 'node'}:${item.osm_id || hashId(name)}`
        return {
          id,
          name,
          type,
          description: 'Найдено через OpenStreetMap (поиск по названию)',
          address: item.display_name || undefined,
          city: intent.city || undefined,
          reviewCount: 0,
          isVerified: false,
          source: 'openstreetmap' as const,
          sourceUrl:
            lat != null && lon != null
              ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
              : undefined,
        }
      })
      .filter(Boolean) as DiscoveredCompany[]
  } catch {
    return []
  }
}

export async function searchCatalog(intent: MarketplaceSearchIntent, limit = 20): Promise<DiscoveredCompany[]> {
  const where: Prisma.CompanyWhereInput = { isActive: true }
  if (intent.type && intent.type !== 'all' && intent.type in CompanyType) {
    where.type = intent.type as CompanyType
  }

  let rows = await prisma.company.findMany({
    where,
    orderBy: [{ isVerified: 'desc' }, { rating: 'desc' }, { name: 'asc' }],
    take: 100,
  })

  if (rows.length === 0) {
    const fallback = filterFallbackCompanies({
      type: intent.type,
      city: intent.city,
      search: intent.query,
      limit: 50,
      offset: 0,
    })
    rows = fallback.companies as any[]
  }

  const filtered = rows.filter((c) => {
    if (intent.city && !citiesMatch(c.city, intent.city)) return false
    if (intent.specialization) {
      const hay = `${c.name} ${c.description || ''}`.toLowerCase()
      if (!hay.includes(intent.specialization)) return false
    }
    const haystack = `${c.name} ${c.description || ''} ${c.city || ''} ${c.address || ''}`
    if (!matchesCompanySearch(haystack, intent.query)) return false
    return true
  })

  return filtered.slice(0, limit).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    description: c.description || undefined,
    address: c.address || undefined,
    city: c.city || undefined,
    phone: c.phone || undefined,
    email: c.email || undefined,
    website: c.website || undefined,
    rating: c.rating ?? undefined,
    reviewCount: c.reviewCount ?? 0,
    isVerified: !!c.isVerified,
    source: 'catalog' as const,
  }))
}

function dedupeCompanies(items: DiscoveredCompany[]) {
  const seen = new Set<string>()
  const out: DiscoveredCompany[] = []
  for (const item of items) {
    const key = item.name.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export async function discoverMarketplaceCompanies(
  intent: MarketplaceSearchIntent,
  options?: { includeWeb?: boolean }
) {
  const includeWeb = options?.includeWeb !== false

  const [catalog, osm, nominatim, web] = await Promise.all([
    searchCatalog(intent),
    searchOpenStreetMap(intent),
    searchNominatimPlaces(intent),
    includeWeb ? searchWeb(intent) : Promise.resolve([]),
  ])

  let merged = dedupeCompanies([...catalog, ...osm, ...nominatim, ...web])
  const tokens = searchTokens(intent.query)
  if (tokens.length > 0) {
    const ranked = merged
      .map((item) => {
        const haystack = `${item.name} ${item.description || ''} ${item.address || ''} ${item.city || ''} ${item.snippet || ''}`
        const score = tokens.reduce((acc, token) => (normalizeSearchText(haystack).includes(token) ? acc + 1 : acc), 0)
        return { item, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
    if (ranked.length > 0) {
      merged = ranked.map(({ item }) => item)
    }
  }

  return {
    companies: merged,
    catalogCount: catalog.length,
    osmCount: osm.length + nominatim.length,
    webCount: web.length,
    intent,
  }
}

export async function summarizeMarketplaceResults(
  message: string,
  intent: MarketplaceSearchIntent,
  companies: DiscoveredCompany[]
): Promise<string> {
  const lines = companies.slice(0, 8).map((c, i) => {
    const src = c.source === 'catalog' ? 'каталог' : c.source === 'openstreetmap' ? 'карта' : 'интернет'
    return `${i + 1}. ${c.name} (${TYPE_LABELS[c.type] || c.type}, ${c.city || 'город не указан'}, источник: ${src})`
  })

  const system = `Ты помощник маркетплейса медицинских услуг PMA. Кратко ответь по-русски на запрос пользователя.
Перечисли найденные клиники/лаборатории из списка ниже. Не придумывай новые организации.
Если результатов мало — предложи уточнить город или специализацию.`

  const user = `Запрос: ${message}
Город: ${intent.city || 'не указан'}
Тип: ${intent.type || 'любой'}

Найдено:
${lines.length ? lines.join('\n') : 'ничего не найдено'}`

  try {
    if (isDeepSeekConfigured()) {
      return await callDeepSeekChat({ system, user, temperature: 0.2 })
    }
    if (isOllamaConfigured()) {
      return await callOllamaChat({ system, user, temperature: 0.2 })
    }
  } catch {
    /* fallback below */
  }

  if (!companies.length) {
    return intent.city
      ? `В каталоге и открытых источниках по городу «${intent.city}» пока мало совпадений. Уточните специализацию или попробуйте соседний город.`
      : 'Укажите город, например: «Найди стоматологию в Казани». Я поищу в каталоге и в интернете.'
  }

  const top = companies.slice(0, 5).map((c) => `• ${c.name}${c.city ? ` (${c.city})` : ''}`).join('\n')
  return `Нашёл ${companies.length} вариантов в каталоге и открытых источниках:\n${top}\n\nВыберите клинику из списка ниже или уточните запрос.`
}
