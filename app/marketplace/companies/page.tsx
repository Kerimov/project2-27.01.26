'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { matchCityFromList, formatCityLabel } from '@/lib/marketplace-city'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  MapPin, Phone, Globe, Star, Building2, TestTube, Pill, 
  ShoppingBag, Dumbbell, UtensilsCrossed, Search, CheckCircle2 
} from 'lucide-react'
import Link from 'next/link'
import { MarketplaceAIChat } from '@/components/MarketplaceAIChat'
import type { DiscoveredCompany } from '@/lib/marketplace-discover'

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
  workingHours?: any
  coordinates?: any
  products: Array<{
    id: string
    name: string
    price?: number
    currency?: string
  }>
  _count: {
    recommendations: number
    products: number
  }
}

const companyTypes = {
  CLINIC: { label: 'Клиника', icon: Building2, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  LABORATORY: { label: 'Лаборатория', icon: TestTube, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  PHARMACY: { label: 'Аптека', icon: Pill, color: 'bg-green-100 text-green-700 border-green-200' },
  HEALTH_STORE: { label: 'Магазин здорового питания', icon: ShoppingBag, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  FITNESS_CENTER: { label: 'Фитнес-центр', icon: Dumbbell, color: 'bg-red-100 text-red-700 border-red-200' },
  NUTRITIONIST: { label: 'Диетолог', icon: UtensilsCrossed, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  OTHER: { label: 'Другое', icon: Building2, color: 'bg-gray-100 text-gray-700 border-gray-200' }
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [total, setTotal] = useState(0)
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [locationDetected, setLocationDetected] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [userCoordinates, setUserCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [detectedCity, setDetectedCity] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<DiscoveredCompany[]>([])
  const fetchSeq = useRef(0)

  const cityForAi = cityFilter || detectedCity || undefined

  const sourceBadge: Record<string, string> = {
    catalog: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    openstreetmap: 'bg-sky-100 text-sky-800 border-sky-200',
    web: 'bg-violet-100 text-violet-800 border-violet-200',
  }
  const sourceLabel: Record<string, string> = {
    catalog: 'Каталог',
    openstreetmap: 'Карта',
    web: 'Интернет',
  }

  const isExternalCompany = (id: string) => id.startsWith('web:') || id.startsWith('osm:')

  const resolveCityForFilter = useCallback(
    (detected: string) => matchCityFromList(detected, availableCities) || formatCityLabel(detected),
    [availableCities]
  )

  const fetchCompanies = useCallback(async () => {
    const seq = ++fetchSeq.current
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (selectedType !== 'all') params.append('type', selectedType)
      if (cityFilter && cityFilter !== 'all') params.append('city', cityFilter)
      if (searchQuery) params.append('search', searchQuery)
      if (verifiedOnly) params.append('verified', 'true')
      if (userCoordinates) {
        params.append('lat', userCoordinates.lat.toString())
        params.append('lng', userCoordinates.lng.toString())
      }
      params.append('limit', '20')

      const url = `/api/marketplace/companies?${params}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Ошибка загрузки компаний')
      }

      const data = await response.json()
      if (seq !== fetchSeq.current) return
      setCompanies(data.companies || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching companies:', error)
      if (seq === fetchSeq.current) {
        setCompanies([])
        setTotal(0)
      }
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [selectedType, cityFilter, searchQuery, verifiedOnly, userCoordinates])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // Загружаем список доступных городов
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await fetch('/api/marketplace/cities')
        if (response.ok) {
          const data = await response.json()
          setAvailableCities(data.cities || [])
        }
      } catch (error) {
        console.error('Error fetching cities:', error)
      }
    }
    fetchCities()
  }, [])

  // Автоматическое определение местоположения
  const detectLocation = async () => {
    setDetectingLocation(true)
    
    // Сначала пробуем через браузерную геолокацию
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords
              console.log('📍 Получены координаты:', latitude, longitude)
              
              // Сохраняем координаты для сортировки по расстоянию
              setUserCoordinates({ lat: latitude, lng: longitude })
              
              // Пробуем определить город через наш API endpoint
              try {
                const response = await fetch('/api/marketplace/geolocation', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ lat: latitude, lng: longitude })
                })
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`)
                }
                
                const data = await response.json()
                console.log('🌍 Геокодирование ответ:', data)
                
                const city = data.city || data.rawCity

                if (city) {
                  const cityToUse = resolveCityForFilter(city)
                  setCityFilter(cityToUse)
                  setDetectedCity(cityToUse)
                  setLocationDetected(true)
                } else {
                  setDetectedCity('Координаты определены')
                  setLocationDetected(true)
                }
              } catch (geocodeError) {
                console.error('❌ Ошибка геокодирования:', geocodeError)
                // Даже если геокодирование не удалось, используем координаты для сортировки
                setDetectedCity('Координаты определены')
                setLocationDetected(true)
                setUserCoordinates({ lat: latitude, lng: longitude })
              } finally {
                // Всегда останавливаем индикатор загрузки
                setDetectingLocation(false)
              }
            } catch (error) {
              console.error('❌ Ошибка обработки местоположения:', error)
              // Пробуем fallback через IP
              const success = await tryIPGeolocation()
              if (!success) {
                alert('Не удалось автоматически определить город. Выберите город вручную из списка.')
              }
              // setDetectingLocation(false) уже вызывается в tryIPGeolocation
            }
          },
          async (error) => {
            console.error('❌ Ошибка геолокации:', error)
            // Если браузерная геолокация не работает, пробуем через IP
            const success = await tryIPGeolocation()
            if (!success) {
              let errorMessage = 'Не удалось определить местоположение. '
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage += 'Разрешите доступ к геолокации в настройках браузера или выберите город вручную.'
                  break
                case error.POSITION_UNAVAILABLE:
                  errorMessage += 'Местоположение недоступно. Выберите город вручную.'
                  break
                case error.TIMEOUT:
                  errorMessage += 'Превышено время ожидания. Выберите город вручную.'
                  break
                default:
                  errorMessage += 'Выберите город вручную.'
                  break
              }
              alert(errorMessage)
            }
          },
          {
            enableHighAccuracy: false, // Ускоряем определение
            timeout: 10000,
            maximumAge: 300000 // 5 минут
          }
        )
      } catch (error) {
        console.error('❌ Критическая ошибка геолокации:', error)
        const success = await tryIPGeolocation()
        if (!success) {
          alert('Геолокация не поддерживается вашим браузером. Выберите город вручную из списка.')
        }
      }
    } else {
      // Если браузерная геолокация не поддерживается, пробуем через IP
      const success = await tryIPGeolocation()
      if (!success) {
        alert('Геолокация не поддерживается вашим браузером. Выберите город вручную из списка.')
      }
    }
  }

  // Fallback: определение города по IP
  const tryIPGeolocation = async () => {
    try {
      console.log('🌐 Пробуем определить город по IP...')
      const response = await fetch('/api/marketplace/geolocation/ip')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('🌍 IP геолокация ответ:', data)
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      if (data.city) {
        const cityToUse = resolveCityForFilter(data.city)
        setCityFilter(cityToUse)
        setDetectedCity(cityToUse)
        setLocationDetected(true)
        if (data.coordinates) {
          setUserCoordinates(data.coordinates)
        }
        return true
      }
      
      return false
    } catch (ipError) {
      console.error('❌ Ошибка IP геолокации:', ipError)
      return false
    } finally {
      // Всегда останавливаем индикатор загрузки
      setDetectingLocation(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCompanies()
  }

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
        className={`w-4 h-4 ${
          i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ))
  }

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary mb-6 shadow-medical">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-gradient-brand">
            Каталог компаний
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
            Найдите проверенные клиники, лаборатории, аптеки и магазины здорового питания в вашем городе
          </p>
          {locationDetected && (detectedCity || userCoordinates) && (
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl shadow-lg mb-4">
              <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full shadow-md">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ваше местоположение</span>
                <div className="flex items-center gap-2">
                  {detectedCity && (
                    <span className="text-lg font-bold text-green-700">{detectedCity}</span>
                  )}
                  {userCoordinates && (
                    <span className="text-sm text-muted-foreground font-mono">
                      ({userCoordinates.lat.toFixed(4)}, {userCoordinates.lng.toFixed(4)})
                    </span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCityFilter('')
                  setLocationDetected(false)
                  setDetectedCity(null)
                  setUserCoordinates(null)
                  fetchCompanies()
                }}
                className="ml-4 text-xs h-auto p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                title="Сбросить определенное местоположение"
              >
                ✕
              </Button>
            </div>
          )}
        </div>

        {/* AI-поиск по каталогу и интернету */}
        <div className="mb-8">
          <MarketplaceAIChat cityHint={cityForAi} onResults={setAiResults} />
        </div>

        {aiResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Результаты AI-поиска</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Каталог, OpenStreetMap и открытые источники в интернете
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {aiResults.map((company) => {
                const typeInfo = companyTypes[company.type as keyof typeof companyTypes] || companyTypes.OTHER
                const IconComponent = typeInfo.icon
                const external = isExternalCompany(company.id)
                const href = external
                  ? company.sourceUrl || company.website || '#'
                  : `/marketplace/companies/${company.id}`

                const card = (
                  <Card className="group hover:shadow-medical-lg transition-all duration-300 border-0 shadow-medical glass-effect h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <Badge variant="outline" className={sourceBadge[company.source] || ''}>
                          {sourceLabel[company.source] || company.source}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {company.name}
                      </CardTitle>
                      <Badge variant="outline" className={`${typeInfo.color} border w-fit`}>
                        {typeInfo.label}
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
                      {company.description && (
                        <p className="line-clamp-2">{company.description}</p>
                      )}
                      {(company.address || company.city) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {[company.address, company.city].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 shrink-0" />
                          <span>{company.phone}</span>
                        </div>
                      )}
                      <span className="text-blue-600 font-medium inline-block">
                        {external ? 'Открыть сайт →' : 'Подробнее →'}
                      </span>
                    </CardContent>
                  </Card>
                )

                if (external) {
                  return (
                    <a
                      key={company.id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {card}
                    </a>
                  )
                }
                return (
                  <Link key={company.id} href={href}>
                    {card}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Фильтры */}
        <div className="mb-8">
          <div className="glass-effect rounded-2xl p-6 shadow-medical">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      placeholder="Поиск по названию или описанию..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-0 bg-white/50"
                    />
                  </div>
                </div>
                <Button type="submit" className="gradient-primary text-white hover:opacity-90">
                  Найти
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full sm:w-64 border-0 bg-white/50">
                    <SelectValue placeholder="Тип компании" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="CLINIC">Клиники</SelectItem>
                    <SelectItem value="LABORATORY">Лаборатории</SelectItem>
                    <SelectItem value="PHARMACY">Аптеки</SelectItem>
                    <SelectItem value="HEALTH_STORE">Магазины здорового питания</SelectItem>
                    <SelectItem value="FITNESS_CENTER">Фитнес-центры</SelectItem>
                    <SelectItem value="NUTRITIONIST">Диетологи</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2 flex-1">
                  <Select value={cityFilter || 'all'} onValueChange={(value) => setCityFilter(value === 'all' ? '' : value)}>
                    <SelectTrigger className="flex-1 border-0 bg-white/50">
                      <SelectValue placeholder="Выберите город" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все города</SelectItem>
                      {availableCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={detectLocation}
                    disabled={detectingLocation}
                    className="border-0 bg-white/50"
                    title="Определить местоположение автоматически"
                  >
                    {detectingLocation ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Определение...
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4 mr-2" />
                        Авто
                      </>
                    )}
                  </Button>
                </div>
                {locationDetected && (detectedCity || userCoordinates) && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                        <MapPin className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-green-800">
                          Местоположение определено
                        </div>
                        <div className="text-xs text-green-600">
                          {detectedCity && (
                            <>
                              Город: <span className="font-semibold">{detectedCity}</span>
                            </>
                          )}
                          {userCoordinates && (
                            <span className={detectedCity ? "ml-2 text-muted-foreground" : ""}>
                              Координаты: ({userCoordinates.lat.toFixed(4)}, {userCoordinates.lng.toFixed(4)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCityFilter('')
                        setLocationDetected(false)
                        setDetectedCity(null)
                        setUserCoordinates(null)
                        fetchCompanies()
                      }}
                      className="text-xs h-auto p-1 text-muted-foreground hover:text-gray-700 hover:bg-green-100"
                      title="Сбросить определенное местоположение"
                    >
                      ✕ Сбросить
                    </Button>
                  </div>
                )}
                {detectingLocation && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <div className="text-sm text-blue-700">
                      Определение местоположения...
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="verified"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="verified" className="text-sm font-medium">
                    Только проверенные
                  </label>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Результаты */}
        <div className="mb-4">
          <p className="text-muted-foreground">
            Найдено компаний: <span className="font-semibold text-foreground">{total}</span>
          </p>
        </div>

        {/* Список компаний */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Загрузка компаний...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Компании не найдены</h3>
            <p className="text-muted-foreground">
              {cityFilter
                ? `В городе «${cityFilter}» пока нет клиник в каталоге. Выберите другой город или сбросьте фильтр.`
                : 'Попробуйте изменить параметры поиска'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => {
              const typeInfo = companyTypes[company.type as keyof typeof companyTypes] || companyTypes.OTHER
              const IconComponent = typeInfo.icon

              return (
                <Link key={company.id} href={`/marketplace/companies/${company.id}`}>
                  <Card className="group hover:shadow-medical-lg transition-all duration-300 border-0 shadow-medical glass-effect h-full">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-xl ${typeInfo.color} shadow-sm border`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        {company.rating && company.rating > 0 && (
                          <div className="flex items-center gap-1">
                            {renderStars(company.rating)}
                            <span className="text-sm font-medium ml-1">
                              {company.rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xl group-hover:text-primary transition-colors flex-1">
                          {company.name}
                        </CardTitle>
                        {company.isVerified && (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                      </div>

                      <Badge variant="outline" className={`${typeInfo.color} border w-fit mt-2`}>
                        {typeInfo.label}
                      </Badge>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {company.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {company.description}
                        </p>
                      )}

                      <div className="space-y-2 text-sm mb-4">
                        {company.address && (
                          <div className="flex items-start gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="line-clamp-1">
                                {company.address}{company.city && `, ${company.city}`}
                              </span>
                              {(company as any).distance !== undefined && (company as any).distance !== Infinity && (
                                <span className="text-xs text-blue-600 ml-2">
                                  • {(company as any).distance.toFixed(1)} км
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {company.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4 flex-shrink-0" />
                            <span>{company.phone}</span>
                          </div>
                        )}

                        {company.website && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="w-4 h-4 flex-shrink-0" />
                            <span className="text-blue-600 hover:underline line-clamp-1">
                              {company.website.replace(/^https?:\/\//, '')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Товары */}
                      {company.products.length > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-3 rounded-xl border border-blue-100">
                          <p className="text-xs font-medium text-gray-700 mb-2">
                            Доступно товаров: {company._count.products}
                          </p>
                          <div className="space-y-1">
                            {company.products.slice(0, 2).map((product) => (
                              <div key={product.id} className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground line-clamp-1 flex-1">
                                  {product.name}
                                </span>
                                {product.price && (
                                  <span className="font-semibold text-green-600 ml-2">
                                    {formatPrice(product.price, product.currency)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{company.reviewCount} отзывов</span>
                          <span className="text-blue-600 font-medium group-hover:underline">
                            Подробнее →
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
