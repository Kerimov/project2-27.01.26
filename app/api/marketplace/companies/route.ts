import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { generateCompaniesWithAI } from '@/lib/ai-companies-generator'
import { isOllamaConfigured } from '@/lib/ollama'
import { filterFallbackCompanies } from '@/lib/marketplace-fallback'

// Этот маршрут читает request.url (query-параметры), поэтому помечаем его как динамический,
// чтобы Next.js не пытался рендерить его статически на этапе билда.
export const dynamic = 'force-dynamic'

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

    const where: any = {
      isActive: true
    }

    if (type && type !== 'all') {
      where.type = type
    }

    // Собираем все условия в массив для правильного объединения
    const conditions: any[] = []

    if (city && city !== 'all') {
      // Нормализуем название города
      const normalizeCityName = (name: string) => {
        return name
          .toLowerCase()
          .replace(/^г\.?\s*/i, '')
          .replace(/\s+город.*$/i, '')
          .trim()
      }
      
      const normalizedCity = normalizeCityName(city)
      
      // Специальные случаи для городов с разными названиями
      const cityMappings: Record<string, string[]> = {
        'санкт-петербург': ['санкт-петербург', 'спб', 'петербург', 'ленинград'],
        'москва': ['москва', 'мск'],
        'нижний новгород': ['нижний новгород', 'нн', 'нижний'],
        'ростов-на-дону': ['ростов-на-дону', 'ростов'],
        'набережные челны': ['набережные челны', 'челны']
      }
      
      const cityVariants = cityMappings[normalizedCity] || [normalizedCity]
      
      // Создаем условия для поиска по городу
      const cityConditions = cityVariants.map(variant => ({
        city: {
          contains: variant,
          mode: 'insensitive' as const
        }
      }))
      
      conditions.push({ OR: cityConditions })
    }

    if (verified === 'true') {
      where.isVerified = true
    }

    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    // Объединяем все условия через AND
    if (conditions.length > 0) {
      where.AND = conditions
    }

    let [companiesData, total] = await Promise.all([
      prisma.company.findMany({
        where,
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
        },
        orderBy: [
          { isVerified: 'desc' },
          { rating: 'desc' },
          { name: 'asc' }
        ],
        take: limit * 2, // Берем больше для последующей сортировки по расстоянию
        skip: offset
      }),
      prisma.company.count({ where })
    ])

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
        const [updatedCompaniesData, updatedTotal] = await Promise.all([
          prisma.company.findMany({
            where,
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
            },
            orderBy: [
              { isVerified: 'desc' },
              { rating: 'desc' },
              { name: 'asc' }
            ],
            take: limit * 2,
            skip: offset
          }),
          prisma.company.count({ where })
        ])

        companiesData = updatedCompaniesData
        total = updatedTotal
      } catch (aiError) {
        logger.error('[COMPANIES] Ошибка генерации компаний через Ollama:', aiError)
        // Продолжаем с пустым списком, если генерация не удалась
      }
    }

    if (total === 0) {
      const fallback = filterFallbackCompanies({ type, city, verified, search, limit, offset })
      return NextResponse.json({
        companies: fallback.companies,
        total: fallback.total,
        limit,
        offset,
        source: 'fallback',
      })
    }

    // Если есть координаты пользователя, вычисляем расстояние и сортируем
    let companies = companiesData
    if (lat && lng) {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)
      
      companies = companiesData
        .map(company => {
          if (company.coordinates && typeof company.coordinates === 'object') {
            const coords = company.coordinates as { lat: number; lng: number }
            const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng)
            return { ...company, distance }
          }
          return { ...company, distance: Infinity }
        })
        .sort((a, b) => {
          // Сначала по расстоянию, потом по рейтингу
          if (Math.abs(a.distance - b.distance) < 0.1) {
            return (b.rating || 0) - (a.rating || 0)
          }
          return a.distance - b.distance
        })
        .slice(0, limit) // Берем только нужное количество
    }

    return NextResponse.json({
      companies,
      total,
      limit,
      offset
    })
  } catch (error) {
    logger.error('Error fetching companies:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Ошибка получения списка компаний' }, { status: 500 })
  }
}