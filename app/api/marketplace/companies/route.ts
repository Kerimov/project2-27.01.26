import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { generateCompaniesWithAI } from '@/lib/ai-companies-generator'
import { isOllamaConfigured } from '@/lib/ollama'
import { filterFallbackCompanies } from '@/lib/marketplace-fallback'
import { citiesMatch } from '@/lib/marketplace-city'
import {
  discoverMarketplaceCompanies,
  parseMarketplaceIntent,
  type DiscoveredCompany,
} from '@/lib/marketplace-discover'

// Этот маршрут читает request.url (query-параметры), поэтому помечаем его как динамический,
// чтобы Next.js не пытался рендерить его статически на этапе билда.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPE_SEARCH_HINT: Record<string, string> = {
  CLINIC: 'клиника',
  LABORATORY: 'лаборатория',
  PHARMACY: 'аптека',
  HEALTH_STORE: 'магазин здорового питания',
  FITNESS_CENTER: 'фитнес',
  NUTRITIONIST: 'диетолог',
}

function mapDiscoveredToApiCompany(c: DiscoveredCompany) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    description: c.description || c.snippet,
    address: c.address || '',
    city: c.city || '',
    phone: c.phone,
    website: c.website,
    rating: c.rating ?? null,
    reviewCount: c.reviewCount ?? 0,
    isVerified: c.isVerified,
    source: c.source,
    sourceUrl: c.sourceUrl || c.website,
    products: [],
    _count: { recommendations: 0, products: 0 },
  }
}

// Функция для вычисления расстояния между двумя точками (формула Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// GET /api/marketplace/companies - получить список компаний
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const city = searchParams.get('city')
    const verified = searchParams.get('verified')
    const search = searchParams.get('search')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const discoverParam = searchParams.get('discover')

    const where: any = {
      isActive: true
    }

    if (type && type !== 'all') {
      where.type = type
    }

    // Собираем все условия в массив для правильного объединения
    const conditions: any[] = []

    const cityFilter = city && city !== 'all' ? city : null
    // Фильтр по городу — в памяти (SQLite не поддерживает mode: 'insensitive' в Prisma)

    if (verified === 'true') {
      where.isVerified = true
    }

    const searchFilter = search?.trim() || null
    // Поиск по названию — в памяти (SQLite + mode: 'insensitive' не поддерживается)

    if (conditions.length > 0) {
      where.AND = conditions
    }

    const companyInclude = {
      products: {
        where: { isAvailable: true },
        take: 3,
      },
      _count: {
        select: {
          recommendations: true,
          products: true,
        },
      },
    } as const

    let companiesData = await prisma.company.findMany({
      where,
      include: companyInclude,
      orderBy: [
        { isVerified: 'desc' },
        { rating: 'desc' },
        { name: 'asc' },
      ],
      ...(cityFilter || searchFilter || lat || lng
        ? {}
        : { take: limit, skip: offset }),
    })

    if (cityFilter) {
      companiesData = companiesData.filter((c) => citiesMatch(c.city, cityFilter))
    }

    if (searchFilter) {
      const q = searchFilter.toLowerCase()
      companiesData = companiesData.filter((c) => {
        const haystack = `${c.name} ${c.description ?? ''} ${c.city ?? ''}`.toLowerCase()
        return haystack.includes(q)
      })
    }

    let total = companiesData.length

    if (!cityFilter && !searchFilter && !lat && !lng) {
      total = await prisma.company.count({ where })
    }

    // Если компаний нет или их мало, и указан город, генерируем через Ollama
    if (total === 0 && city && city !== 'all' && isOllamaConfigured()) {
      try {
        logger.info(`[COMPANIES] Генерация компаний через Ollama для города: ${city}, тип: ${type || 'all'}`)
        
        // Определяем типы компаний для генерации
        const typesToGenerate = type && type !== 'all' 
          ? [type] 
          : ['CLINIC', 'LABORATORY'] // По умолчанию клиники и лаборатории
        
        logger.info(`[COMPANIES] Типы для генерации: ${typesToGenerate.join(', ')}`)
        
        // Генерируем компании через Ollama
        const generatedCompanies = await generateCompaniesWithAI(
          city,
          typesToGenerate,
          Math.max(limit, 10) // Генерируем минимум 10 компаний
        )

        logger.info(`[COMPANIES] Сгенерировано ${generatedCompanies.length} компаний через Ollama`)

        // Сохраняем сгенерированные компании в базу данных
        const savedCompanies = []
        for (const companyData of generatedCompanies) {
          try {
            // Проверяем, не существует ли уже компания с таким именем и городом
            const existing = await prisma.company.findFirst({
              where: {
                name: companyData.name,
                city: companyData.city
              }
            })

            if (!existing) {
              const saved = await prisma.company.create({
                data: {
                  name: companyData.name,
                  type: companyData.type,
                  description: companyData.description,
                  address: companyData.address,
                  city: companyData.city,
                  phone: companyData.phone,
                  email: companyData.email,
                  website: companyData.website,
                  rating: companyData.rating,
                  reviewCount: companyData.reviewCount,
                  coordinates: companyData.coordinates ? JSON.parse(JSON.stringify(companyData.coordinates)) : null,
                  workingHours: companyData.workingHours ? JSON.parse(JSON.stringify(companyData.workingHours)) : null,
                  isVerified: companyData.isVerified,
                  isActive: true
                },
                include: {
                  products: {
                    where: { isAvailable: true },
                    take: 3
                  },
                  _count: {
                    select: { 
                      recommendations: true,
                      products: true
                    }
                  }
                }
              })
              savedCompanies.push(saved)
            }
          } catch (saveError) {
            logger.error(`[COMPANIES] Ошибка сохранения компании ${companyData.name}:`, saveError)
            // Продолжаем, даже если одна компания не сохранилась
          }
        }

        logger.info(`[COMPANIES] Сохранено ${savedCompanies.length} новых компаний в базу`)

        // Обновляем данные из базы с учетом новых компаний
        companiesData = await prisma.company.findMany({
          where,
          include: companyInclude,
          orderBy: [
            { isVerified: 'desc' },
            { rating: 'desc' },
            { name: 'asc' },
          ],
        })
        if (cityFilter) {
          companiesData = companiesData.filter((c) => citiesMatch(c.city, cityFilter))
        }
        if (searchFilter) {
          const q = searchFilter.toLowerCase()
          companiesData = companiesData.filter((c) => {
            const haystack = `${c.name} ${c.description ?? ''} ${c.city ?? ''}`.toLowerCase()
            return haystack.includes(q)
          })
        }
        total = companiesData.length
      } catch (aiError) {
        logger.error('[COMPANIES] Ошибка генерации компаний через Ollama:', aiError)
        // Продолжаем с пустым списком, если генерация не удалась
      }
    }

    if (total === 0) {
      const fallback = filterFallbackCompanies({ type, city: cityFilter, verified, search, limit, offset })
      return NextResponse.json({
        companies: fallback.companies,
        total: fallback.total,
        limit,
        offset,
        source: 'fallback',
      })
    }

    let companies = companiesData

    if (cityFilter && companies.length === 0) {
      const fallback = filterFallbackCompanies({ type, city: cityFilter, verified, search, limit, offset })
      return NextResponse.json({
        companies: fallback.companies,
        total: fallback.total,
        limit,
        offset,
        source: 'fallback',
      })
    }

    const MAX_DISTANCE_KM = 120

    if (lat && lng) {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)

      companies = companies
        .map((company) => {
          if (company.coordinates && typeof company.coordinates === 'object') {
            const coords = company.coordinates as { lat: number; lng: number }
            const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng)
            return { ...company, distance }
          }
          return { ...company, distance: Infinity }
        })
        .filter((company) => {
          if (!cityFilter) return true
          if (!citiesMatch(company.city, cityFilter)) return false
          return company.distance <= MAX_DISTANCE_KM
        })
        .sort((a, b) => {
          if (Math.abs(a.distance - b.distance) < 0.1) {
            return (b.rating || 0) - (a.rating || 0)
          }
          return a.distance - b.distance
        })
        .slice(0, limit)
    } else if (cityFilter) {
      companies = companies.slice(0, limit)
      total = companies.length
    } else {
      companies = companies.slice(0, limit)
    }

    const shouldDiscover =
      verified !== 'true' &&
      (discoverParam === 'true' ||
        (discoverParam !== 'false' && !!(searchFilter || cityFilter)))

    let catalogCount = companies.length
    let osmCount = 0
    let webCount = 0

    if (shouldDiscover) {
      const intent = parseMarketplaceIntent(
        searchFilter || [type && type !== 'all' ? TYPE_SEARCH_HINT[type] || '' : '', cityFilter || ''].filter(Boolean).join(' ').trim() || 'медицинские клиники',
        cityFilter
      )
      if (type && type !== 'all') intent.type = type

      try {
        const discovery = await discoverMarketplaceCompanies(intent, { includeWeb: true })
        catalogCount = discovery.catalogCount
        osmCount = discovery.osmCount
        webCount = discovery.webCount

        const mergedById = new Map(companies.map((c) => [c.id, c]))
        const mergedNames = new Set(
          companies.map((c) => c.name.toLowerCase().replace(/\s+/g, ' ').trim())
        )

        for (const discovered of discovery.companies) {
          const nameKey = discovered.name.toLowerCase().replace(/\s+/g, ' ').trim()
          if (mergedById.has(discovered.id) || mergedNames.has(nameKey)) continue

          if (discovered.source === 'catalog') {
            const full = companiesData.find((row) => row.id === discovered.id)
            if (full) {
              mergedById.set(full.id, full)
              mergedNames.add(nameKey)
              continue
            }
          }

          const mapped = mapDiscoveredToApiCompany(discovered)
          mergedById.set(mapped.id, mapped as unknown as (typeof companies)[number])
          mergedNames.add(nameKey)
        }

        companies = Array.from(mergedById.values()).slice(0, Math.max(limit, 30)) as typeof companies
        total = companies.length
      } catch (discoverError) {
        logger.warn('[COMPANIES] Discovery search failed:', discoverError)
      }
    }

    return NextResponse.json({
      companies,
      total,
      limit,
      offset,
      ...(shouldDiscover
        ? { discovery: { catalogCount, osmCount, webCount, enabled: true } }
        : {}),
    })
  } catch (error) {
    logger.error('Error fetching companies:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Ошибка получения списка компаний' }, { status: 500 })
  }
}