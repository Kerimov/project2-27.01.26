'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  MapPin, Phone, Globe, Star, Building2, TestTube, Pill, 
  ShoppingBag, Dumbbell, UtensilsCrossed, Clock, CheckCircle2,
  Mail, ArrowLeft, ExternalLink
} from 'lucide-react'
import Link from 'next/link'

interface Company {
  id: string
  name: string
  type: string
  description?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  website?: string
  rating?: number
  reviewCount: number
  imageUrl?: string
  isVerified: boolean
  services?: string[]
  workingHours?: {
    [key: string]: { start: string; end: string }
  }
  coordinates?: { lat: number; lng: number }
  products: Array<{
    id: string
    name: string
    description?: string
    category?: string
    price?: number
    currency?: string
    imageUrl?: string
    tags?: string[]
  }>
  _count: {
    recommendations: number
    products: number
  }
}

const companyTypes: { [key: string]: { label: string; icon: any; color: string } } = {
  CLINIC: { label: 'Клиника', icon: Building2, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  LABORATORY: { label: 'Лаборатория', icon: TestTube, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  PHARMACY: { label: 'Аптека', icon: Pill, color: 'bg-green-100 text-green-700 border-green-200' },
  HEALTH_STORE: { label: 'Магазин здорового питания', icon: ShoppingBag, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  FITNESS_CENTER: { label: 'Фитнес-центр', icon: Dumbbell, color: 'bg-red-100 text-red-700 border-red-200' },
  NUTRITIONIST: { label: 'Диетолог', icon: UtensilsCrossed, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  OTHER: { label: 'Другое', icon: Building2, color: 'bg-gray-100 text-gray-700 border-gray-200' }
}

const daysOfWeek: { [key: string]: string } = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
  saturday: 'Суббота',
  sunday: 'Воскресенье'
}

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/marketplace/companies/${params.id}`)

        if (!response.ok) {
          throw new Error('Компания не найдена')
        }

        const data = await response.json()
        setCompany(data.company)
      } catch (error) {
        console.error('Error fetching company:', error)
        setError('Не удалось загрузить информацию о компании')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchCompany()
    }
  }, [params.id])

  const formatPrice = (price: number, currency: string = 'RUB') => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency
    }).format(price)
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${
          i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ))
  }

  if (loading) {
    return (
      <div className="web-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка информации...</p>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="web-page flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{error || 'Компания не найдена'}</h3>
          <Button onClick={() => router.back()} variant="outline">
            Вернуться назад
          </Button>
        </div>
      </div>
    )
  }

  const typeInfo = companyTypes[company.type] || companyTypes.OTHER
  const IconComponent = typeInfo.icon

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8">
        {/* Кнопка назад */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6 hover:bg-white/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к каталогу
        </Button>

        {/* Основная информация */}
        <Card className="border-0 shadow-medical glass-effect mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className={`p-4 rounded-2xl ${typeInfo.color} shadow-sm border`}>
                <IconComponent className="w-12 h-12" />
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold">{company.name}</h1>
                      {company.isVerified && (
                        <Badge className="bg-green-600 text-white border-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Проверено
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className={`${typeInfo.color} border`}>
                      {typeInfo.label}
                    </Badge>
                  </div>

                  {company.rating && company.rating > 0 && (
                    <div className="text-center">
                      <div className="flex items-center gap-1 mb-1">
                        {renderStars(company.rating)}
                      </div>
                      <p className="text-2xl font-bold">{company.rating.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{company.reviewCount} отзывов</p>
                    </div>
                  )}
                </div>

                {company.description && (
                  <p className="text-lg text-muted-foreground mb-4">{company.description}</p>
                )}

                {/* Контакты */}
                <div className="grid md:grid-cols-2 gap-3">
                  {company.address && (
                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg">
                      <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Адрес</p>
                        <p className="text-sm">{company.address}{company.city && `, ${company.city}`}</p>
                      </div>
                    </div>
                  )}

                  {company.phone && (
                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg">
                      <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Телефон</p>
                        <a href={`tel:${company.phone}`} className="text-sm text-blue-600 hover:underline">
                          {company.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {company.email && (
                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg">
                      <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <a href={`mailto:${company.email}`} className="text-sm text-blue-600 hover:underline">
                          {company.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {company.website && (
                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg">
                      <Globe className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Веб-сайт</p>
                        <a 
                          href={company.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {company.website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Левая колонка */}
          <div className="md:col-span-2 space-y-6">
            {/* Услуги */}
            {company.services && company.services.length > 0 && (
              <Card className="border-0 shadow-medical glass-effect">
                <CardHeader>
                  <CardTitle>Услуги</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {company.services.map((service, index) => (
                      <Badge key={index} variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Товары и услуги */}
            {company.products.length > 0 && (
              <Card className="border-0 shadow-medical glass-effect">
                <CardHeader>
                  <CardTitle>Товары ({company.products.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {company.products.map((product) => (
                      <div key={product.id} className="p-4 bg-white/60 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold flex-1">{product.name}</h4>
                          {product.price && (
                            <span className="font-bold text-green-600 ml-2">
                              {formatPrice(product.price, product.currency)}
                            </span>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        {product.category && (
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                        )}
                        {product.tags && product.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.tags.map((tag, index) => (
                              <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Правая колонка */}
          <div className="space-y-6">
            {/* Часы работы */}
            {company.workingHours && Object.keys(company.workingHours).length > 0 && (
              <Card className="border-0 shadow-medical glass-effect">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Часы работы
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(company.workingHours).map(([day, hours]: [string, any]) => (
                      <div key={day} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm font-medium">{daysOfWeek[day] || day}</span>
                        <span className="text-sm text-muted-foreground">
                          {hours.start} - {hours.end}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Карта (заглушка) */}
            {company.coordinates && (
              <Card className="border-0 shadow-medical glass-effect">
                <CardHeader>
                  <CardTitle>Расположение на карте</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center">
                    <p className="text-muted-foreground">Карта: {company.coordinates.lat}, {company.coordinates.lng}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Интеграция с картами в разработке
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Статистика */}
            <Card className="border-0 shadow-medical glass-effect">
              <CardHeader>
                <CardTitle>Статистика</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">Рекомендаций</span>
                    <span className="text-lg font-bold text-blue-600">{company._count.recommendations}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium">Товаров</span>
                    <span className="text-lg font-bold text-green-600">{company._count.products}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium">Отзывов</span>
                    <span className="text-lg font-bold text-purple-600">{company.reviewCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
