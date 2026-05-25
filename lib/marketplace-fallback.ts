import { citiesMatch } from '@/lib/marketplace-city'

export const fallbackCompanies = [
  {
    id: 'fallback-invitro',
    name: 'Инвитро',
    type: 'LABORATORY',
    description: 'Сеть медицинских лабораторий с широким спектром исследований и удобной выдачей результатов.',
    address: 'ул. Арбат, 25',
    city: 'Москва',
    phone: '+7 (495) 363-36-36',
    email: 'info@invitro.ru',
    website: 'https://invitro.ru',
    rating: 4.5,
    reviewCount: 240,
    imageUrl: null,
    services: ['Клинические анализы', 'Биохимия крови', 'Гормоны', 'Инфекции'],
    workingHours: { 'Пн-Пт': '07:30-19:30', 'Сб': '08:00-17:00', 'Вс': '09:00-15:00' },
    coordinates: { lat: 55.7522, lng: 37.5911 },
    isVerified: true,
    isActive: true,
    products: [],
    recommendations: [],
    _count: { recommendations: 0, products: 0 },
  },
  {
    id: 'fallback-gemotest',
    name: 'Гемотест',
    type: 'LABORATORY',
    description: 'Лаборатория для плановых анализов, профилактических обследований и мониторинга показателей.',
    address: 'пр. Мира, 45',
    city: 'Москва',
    phone: '+7 (495) 532-13-13',
    email: 'info@gemotest.ru',
    website: 'https://gemotest.ru',
    rating: 4.3,
    reviewCount: 180,
    imageUrl: null,
    services: ['Общий анализ крови', 'Витамины', 'Иммунология', 'Онкомаркеры'],
    workingHours: { 'Пн-Пт': '07:00-20:00', 'Сб': '08:00-18:00', 'Вс': '09:00-16:00' },
    coordinates: { lat: 55.7887, lng: 37.6341 },
    isVerified: true,
    isActive: true,
    products: [],
    recommendations: [],
    _count: { recommendations: 0, products: 0 },
  },
  {
    id: 'fallback-family-clinic',
    name: 'Клиника “Семейная”',
    type: 'CLINIC',
    description: 'Многопрофильная клиника для взрослых и детей: терапия, диагностика, профилактические осмотры.',
    address: 'ул. Пушкина, 15',
    city: 'Москва',
    phone: '+7 (495) 345-67-89',
    email: 'hello@family-clinic.ru',
    website: 'https://family-clinic.ru',
    rating: 4.7,
    reviewCount: 96,
    imageUrl: null,
    services: ['Терапевт', 'Кардиолог', 'УЗИ', 'Чек-апы'],
    workingHours: { 'Пн-Пт': '08:00-21:00', 'Сб': '09:00-18:00' },
    coordinates: { lat: 55.7616, lng: 37.6094 },
    isVerified: true,
    isActive: true,
    products: [],
    recommendations: [],
    _count: { recommendations: 0, products: 0 },
  },
  {
    id: 'fallback-spb-lab',
    name: 'Лаборатория Север',
    type: 'LABORATORY',
    description: 'Лабораторные исследования и выездной забор анализов в Санкт-Петербурге.',
    address: 'Невский проспект, 64',
    city: 'Санкт-Петербург',
    phone: '+7 (812) 222-10-20',
    email: 'info@sever-lab.ru',
    website: 'https://sever-lab.ru',
    rating: 4.4,
    reviewCount: 73,
    imageUrl: null,
    services: ['Анализы крови', 'ПЦР', 'Гормоны', 'Домашний забор'],
    workingHours: { 'Пн-Пт': '08:00-20:00', 'Сб': '09:00-17:00' },
    coordinates: { lat: 59.9343, lng: 30.3351 },
    isVerified: true,
    isActive: true,
    products: [],
    recommendations: [],
    _count: { recommendations: 0, products: 0 },
  },
]

export function filterFallbackCompanies(params: {
  type?: string | null
  city?: string | null
  verified?: string | null
  search?: string | null
  limit?: number
  offset?: number
}) {
  const type = params.type && params.type !== 'all' ? params.type : null
  const city = params.city && params.city !== 'all' ? params.city : null
  const search = params.search?.toLowerCase().trim()
  const verifiedOnly = params.verified === 'true'

  const filtered = fallbackCompanies.filter((company) => {
    if (type && company.type !== type) return false
    if (verifiedOnly && !company.isVerified) return false
    if (city && !citiesMatch(company.city, city)) return false
    if (search) {
      const haystack = `${company.name} ${company.description ?? ''} ${company.city ?? ''}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })

  const offset = params.offset ?? 0
  const limit = params.limit ?? 20

  return {
    companies: filtered.slice(offset, offset + limit),
    total: filtered.length,
  }
}

