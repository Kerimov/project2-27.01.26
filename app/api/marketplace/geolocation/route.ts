import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/marketplace/geolocation - определить город по координатам
export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json()

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Координаты не предоставлены' }, { status: 400 })
    }

    // Используем OpenStreetMap Nominatim для обратного геокодирования
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru`,
      {
        headers: {
          'User-Agent': 'Medical Assistant App',
          'Accept-Language': 'ru-RU,ru;q=0.9'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const data = await response.json()

    // Только населённый пункт; область/регион не подставляем как «город»
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality

    // Нормализуем название города
    const normalizedCity = city ? city
      .replace(/^г\.?\s*/i, '')
      .replace(/\s+город.*$/i, '')
      .trim() : null

    return NextResponse.json({
      city: normalizedCity,
      rawCity: city,
      address: data.address,
      coordinates: { lat, lng }
    })
  } catch (error) {
    logger.error('Error geocoding:', error)
    return NextResponse.json(
      { error: 'Ошибка определения города по координатам' },
      { status: 500 }
    )
  }
}

