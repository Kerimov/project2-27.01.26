import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { fallbackCompanies } from '@/lib/marketplace-fallback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/marketplace/cities - получить список городов с компаниями
export async function GET(request: NextRequest) {
  try {
    const cities = await prisma.company.findMany({
      where: {
        isActive: true,
        city: { not: null }
      },
      select: {
        city: true
      },
      distinct: ['city']
    })

    const fallbackCities = fallbackCompanies
      .map((company) => company.city)
      .filter(Boolean)

    const cityList = Array.from(new Set([
      ...cities
      .map(c => c.city)
      .filter((city): city is string => city !== null),
      ...fallbackCities,
    ]))
      .sort()

    return NextResponse.json({ cities: cityList })
  } catch (error) {
    logger.error('Error fetching cities:', error)
    return NextResponse.json({ error: 'Ошибка получения списка городов' }, { status: 500 })
  }
}

