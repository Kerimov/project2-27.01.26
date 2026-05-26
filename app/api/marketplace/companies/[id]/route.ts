import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { fallbackCompanies } from '@/lib/marketplace-fallback'

export const runtime = 'nodejs'

// GET /api/marketplace/companies/[id] - получить детальную информацию о компании
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const company = await prisma.company.findUnique({
      where: { 
        id: params.id,
        isActive: true
      },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: { createdAt: 'desc' }
        },
        recommendations: {
          where: { status: 'ACTIVE' },
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { 
            recommendations: true,
            products: true
          }
        }
      }
    })

    if (!company) {
      const fallbackCompany = fallbackCompanies.find((item) => item.id === params.id)
      if (fallbackCompany) {
        return NextResponse.json({ company: fallbackCompany, source: 'fallback' })
      }
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
    }

    return NextResponse.json({ company })
  } catch (error) {
    logger.error('Error fetching company:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Ошибка получения информации о компании' }, { status: 500 })
  }
}