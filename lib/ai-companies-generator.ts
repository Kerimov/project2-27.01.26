/**
 * Генерация списка клиник и лабораторий через Ollama
 */

import { callOllamaChat, isOllamaConfigured } from './ollama'

interface GeneratedCompany {
  name: string
  type: 'CLINIC' | 'LABORATORY' | 'PHARMACY' | 'HEALTH_STORE' | 'FITNESS_CENTER' | 'NUTRITIONIST'
  description: string
  address: string
  city: string
  phone?: string
  email?: string
  website?: string
  rating?: number
  reviewCount: number
  coordinates?: { lat: number; lng: number }
  workingHours?: any
  isVerified: boolean
}

export async function generateCompaniesWithAI(
  city: string,
  types: string[] = ['CLINIC', 'LABORATORY'],
  count: number = 10
): Promise<GeneratedCompany[]> {
  if (!isOllamaConfigured()) {
    throw new Error('Ollama отключена (OLLAMA_DISABLED=true)')
  }

  const typesLabels: Record<string, string> = {
    CLINIC: 'клиники',
    LABORATORY: 'лаборатории',
    PHARMACY: 'аптеки',
    HEALTH_STORE: 'магазины здорового питания',
    FITNESS_CENTER: 'фитнес-центры',
    NUTRITIONIST: 'диетологи'
  }

  const requestedTypes = types.map(t => typesLabels[t] || t).join(', ')

  const prompt = `Ты - эксперт по медицинским учреждениям России. Сгенерируй список реальных ${requestedTypes} в городе ${city}.

ВАЖНО:
1. Используй ТОЛЬКО реальные, существующие медицинские учреждения
2. Названия должны быть точными и официальными
3. Адреса должны быть реальными и точными
4. Телефоны должны быть в формате +7 (XXX) XXX-XX-XX
5. Рейтинги должны быть реалистичными (от 3.5 до 5.0)
6. Координаты должны быть приблизительными, но реалистичными для указанного адреса

Верни ТОЛЬКО JSON массив (без дополнительного текста) с ${count} компаниями в следующем формате:
[
  {
    "name": "Полное официальное название",
    "type": "CLINIC" или "LABORATORY",
    "description": "Краткое описание (2-3 предложения)",
    "address": "Полный адрес с улицей и номером дома",
    "city": "${city}",
    "phone": "+7 (XXX) XXX-XX-XX",
    "email": "contact@example.com",
    "website": "https://example.com",
    "rating": 4.5,
    "reviewCount": 150,
    "coordinates": {"lat": 59.9343, "lng": 30.3351},
    "workingHours": {"monday": {"start": "09:00", "end": "18:00"}, "tuesday": {"start": "09:00", "end": "18:00"}, "wednesday": {"start": "09:00", "end": "18:00"}, "thursday": {"start": "09:00", "end": "18:00"}, "friday": {"start": "09:00", "end": "18:00"}, "saturday": {"start": "10:00", "end": "16:00"}, "sunday": {"start": "10:00", "end": "16:00"}},
    "isVerified": true
  }
]

Город: ${city}
Типы: ${requestedTypes}
Количество: ${count}

ВАЖНО: Верни ТОЛЬКО JSON массив, без дополнительного текста или объяснений.`

  try {
    const content = (
      await callOllamaChat({
        system:
          'Ты эксперт по медицинским учреждениям России. Ты генерируешь только реальные, существующие компании с точными данными. Всегда отвечаешь валидным JSON массивом компаний.',
        user: prompt,
        temperature: 0.3,
        responseFormat: { type: 'json_object' },
      })
    ).trim()

    console.log('[AI-COMPANIES] Ollama response length:', content.length)
    console.log('[AI-COMPANIES] Ollama response preview:', content.substring(0, 200))
    
    // Парсим JSON ответ
    let parsed: any
    try {
      // Пытаемся распарсить напрямую
      parsed = JSON.parse(content)
    } catch (e) {
      // Если прямой парсинг не удался, пытаемся найти JSON массив в тексте
      const jsonArrayMatch = content.match(/\[[\s\S]*\]/)
      if (jsonArrayMatch) {
        try {
          parsed = JSON.parse(jsonArrayMatch[0])
        } catch (e2) {
          // Если и это не сработало, пытаемся найти JSON объект
          const jsonObjectMatch = content.match(/\{[\s\S]*\}/)
          if (jsonObjectMatch) {
            parsed = JSON.parse(jsonObjectMatch[0])
          } else {
            throw new Error(`Не удалось извлечь JSON из ответа Ollama: ${e}`)
          }
        }
      } else {
        throw new Error(`Не удалось найти JSON массив в ответе Ollama: ${e}`)
      }
    }

    // Если ответ обернут в объект (например, {companies: [...]} или response_format вернул объект)
    let companies: any[]
    if (Array.isArray(parsed)) {
      companies = parsed
    } else if (parsed.companies && Array.isArray(parsed.companies)) {
      companies = parsed.companies
    } else if (parsed.data && Array.isArray(parsed.data)) {
      companies = parsed.data
    } else if (parsed.items && Array.isArray(parsed.items)) {
      companies = parsed.items
    } else {
      // Если это объект, ищем первый массив среди значений
      const firstArrayValue = Object.values(parsed).find(v => Array.isArray(v))
      companies = firstArrayValue as any[] || []
      
      if (companies.length === 0) {
        console.error('[AI-COMPANIES] Не удалось извлечь массив компаний из ответа:', parsed)
        throw new Error('Ollama вернул ответ в неожиданном формате')
      }
    }

    if (!Array.isArray(companies) || companies.length === 0) {
      throw new Error('Ollama вернул пустой массив компаний')
    }

    // Валидация и нормализация данных
    return companies.map((company: any) => ({
      name: company.name || 'Неизвестная компания',
      type: company.type || 'CLINIC',
      description: company.description || '',
      address: company.address || '',
      city: company.city || city,
      phone: company.phone,
      email: company.email,
      website: company.website,
      rating: company.rating || 4.0,
      reviewCount: company.reviewCount || 0,
      coordinates: company.coordinates || undefined,
      workingHours: company.workingHours || undefined,
      isVerified: company.isVerified !== undefined ? company.isVerified : true
    }))

  } catch (error) {
    console.error('[AI-COMPANIES] Ошибка генерации компаний:', error)
    throw error
  }
}

