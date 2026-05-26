'use client'

import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, Calendar, MapPin, User, FileText, Search, Filter, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Sparkles, Bell } from 'lucide-react'
import Link from 'next/link'

interface AnalysisResult {
  [key: string]: {
    value: string | number
    unit?: string
    normal?: boolean
  }
}

interface Analysis {
  id: string
  title: string
  type: string
  date: string
  laboratory?: string
  doctor?: string
  results: string // JSON string from API
  normalRange?: string
  status: 'normal' | 'abnormal' | 'critical'
  notes?: string
  createdAt: string
  updatedAt: string
  documentId?: string
}

interface AnalysisCategory {
  name: string
  icon: React.ReactNode
  color: string
  analyses: Analysis[]
}

type IndicatorPoint = {
  analysisId: string
  documentId?: string
  date: string
  title: string
  value: number
  unit?: string
  isNormal?: boolean | null
}

type AiTrendResult = {
  tldr: string
  whatChanged: string[]
  possibleCauses: Array<{ cause: string; why?: string; likelihood?: 'low' | 'medium' | 'high' | string }>
  confidence: number
  redFlags: string[]
  nextSteps: string[]
  questionsToRefine: string[]
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const v = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''))
    return Number.isFinite(v) ? v : null
  }
  return null
}

function sparklinePath(values: number[], width = 140, height = 36) {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = values.length === 1 ? 0 : width / (values.length - 1)
  const points = values.map((v, idx) => {
    const x = idx * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return `M ${points.join(' L ')}`
}

export default function AnalysesPage() {
  const { user, token } = useAuth()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [selectedIndicator, setSelectedIndicator] = useState<string>('')
  const [aiTrend, setAiTrend] = useState<AiTrendResult | null>(null)
  const [aiTrendRaw, setAiTrendRaw] = useState<string | null>(null)
  const [aiPlanText, setAiPlanText] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  useEffect(() => {
    if (token) {
      fetchAnalyses()
    }
  }, [token])

  const fetchAnalyses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analyses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Ошибка при загрузке анализов')
      }

      const data = await response.json()
      setAnalyses(data.analyses)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  // Группировка анализов по категориям
  const categorizeAnalyses = (analyses: Analysis[]): AnalysisCategory[] => {
    const categories: { [key: string]: Analysis[] } = {}
    
    analyses.forEach(analysis => {
      const categoryName = getAnalysisCategory(analysis.type)
      if (!categories[categoryName]) {
        categories[categoryName] = []
      }
      categories[categoryName].push(analysis)
    })

    return Object.entries(categories).map(([name, analyses]) => ({
      name,
      icon: getCategoryIcon(name),
      color: getCategoryColor(name),
      analyses: analyses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }))
  }

  // Определение категории анализа по типу
  const getAnalysisCategory = (type: string): string => {
    const typeLower = type.toLowerCase()
    
    if (typeLower.includes('кров') || typeLower.includes('гемоглобин') || typeLower.includes('эритроцит') || typeLower.includes('лейкоцит')) {
      return 'Общий анализ крови'
    }
    if (typeLower.includes('биохим') || typeLower.includes('глюкоз') || typeLower.includes('холестерин') || typeLower.includes('белок')) {
      return 'Биохимический анализ'
    }
    if (typeLower.includes('моч') || typeLower.includes('урин')) {
      return 'Анализ мочи'
    }
    if (typeLower.includes('гормон') || typeLower.includes('тиреоид') || typeLower.includes('инсулин')) {
      return 'Гормональные исследования'
    }
    if (typeLower.includes('онко') || typeLower.includes('маркер') || typeLower.includes('опухол')) {
      return 'Онкомаркеры'
    }
    if (typeLower.includes('инфекц') || typeLower.includes('вирус') || typeLower.includes('бактери') || typeLower.includes('антител')) {
      return 'Инфекционные заболевания'
    }
    if (typeLower.includes('аллерг') || typeLower.includes('иммуноглобулин')) {
      return 'Аллергология'
    }
    if (typeLower.includes('коагул') || typeLower.includes('свертывани') || typeLower.includes('тромб')) {
      return 'Коагулограмма'
    }
    
    return 'Прочие анализы'
  }

  // Иконки для категорий
  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName) {
      case 'Общий анализ крови':
        return <TrendingUp className="h-5 w-5" />
      case 'Биохимический анализ':
        return <TrendingDown className="h-5 w-5" />
      case 'Анализ мочи':
        return <Minus className="h-5 w-5" />
      case 'Гормональные исследования':
        return <TrendingUp className="h-5 w-5" />
      case 'Онкомаркеры':
        return <TrendingUp className="h-5 w-5" />
      case 'Инфекционные заболевания':
        return <TrendingDown className="h-5 w-5" />
      case 'Аллергология':
        return <Minus className="h-5 w-5" />
      case 'Коагулограмма':
        return <TrendingUp className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  // Цвета для категорий
  const getCategoryColor = (categoryName: string): string => {
    switch (categoryName) {
      case 'Общий анализ крови':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'Биохимический анализ':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Анализ мочи':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Гормональные исследования':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Онкомаркеры':
        return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'Инфекционные заболевания':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Аллергология':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Коагулограмма':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Фильтрация анализов
  const filteredAnalyses = analyses.filter(analysis => {
    const matchesSearch = analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         analysis.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         analysis.laboratory?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const categorizedAnalyses = categorizeAnalyses(filteredAnalyses)

  // Переключение развернутости категории
  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-800'
      case 'abnormal':
        return 'bg-yellow-100 text-yellow-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal':
        return 'Норма'
      case 'abnormal':
        return 'Отклонение'
      case 'critical':
        return 'Критично'
      default:
        return status
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Парсинг результатов анализа
  const parseAnalysisResults = (resultsString: string): AnalysisResult => {
    try {
      const parsed = JSON.parse(resultsString)
      if (parsed.indicators && Array.isArray(parsed.indicators)) {
        const result: AnalysisResult = {}
        parsed.indicators.forEach((indicator: any) => {
          if (indicator.name && indicator.value !== undefined) {
            result[indicator.name] = {
              value: indicator.value,
              unit: indicator.unit || '',
              normal: indicator.isNormal
            }
          }
        })
        return result
      }
      return parsed
    } catch {
      return {}
    }
  }

  const indicatorSeries = useMemo(() => {
    const map: Record<string, IndicatorPoint[]> = {}
    for (const a of analyses) {
      const parsed = parseAnalysisResults(a.results)
      for (const [name, obj] of Object.entries(parsed || {})) {
        const num = toNumber(obj?.value)
        if (num === null) continue
        if (!map[name]) map[name] = []
        map[name].push({
          analysisId: a.id,
          documentId: a.documentId,
          date: a.date,
          title: a.title,
          value: num,
          unit: obj?.unit,
          isNormal: typeof obj?.normal === 'boolean' ? obj.normal : null
        })
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
    }
    return map
  }, [analyses])

  const indicatorNames = useMemo(() => Object.keys(indicatorSeries).sort((a, b) => a.localeCompare(b, 'ru')), [indicatorSeries])

  useEffect(() => {
    if (!selectedIndicator && indicatorNames.length > 0) {
      setSelectedIndicator(indicatorNames[0])
    }
  }, [indicatorNames, selectedIndicator])

  const selectedSeries = selectedIndicator ? indicatorSeries[selectedIndicator] || [] : []
  const selectedValues = selectedSeries.map(p => p.value)
  const trendDelta = selectedValues.length >= 2 ? selectedValues[selectedValues.length - 1] - selectedValues[selectedValues.length - 2] : 0
  const trendLabel = selectedValues.length < 2 ? '—' : trendDelta > 0 ? 'Рост' : trendDelta < 0 ? 'Снижение' : 'Без изменений'

  const callAI = async (mode: 'trend' | 'plan') => {
    if (!selectedIndicator || selectedSeries.length === 0) return
    setAiBusy(true)
    if (mode === 'trend') {
      setAiTrend(null)
      setAiTrendRaw(null)
    }
    if (mode === 'plan') setAiPlanText(null)
    try {
      // берем до 5 последних документов из серии (если есть)
      const docIds = Array.from(
        new Set(
          selectedSeries
            .map((p) => p.documentId)
            .filter((x): x is string => typeof x === 'string' && x.length > 0)
            .slice(-5)
        )
      )

      if (mode === 'trend') {
        const res = await fetch('/api/ai/analysis-trend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            indicatorName: selectedIndicator,
            series: selectedSeries.slice(-12).map((p) => ({
              date: p.date,
              value: p.value,
              unit: p.unit,
              isNormal: p.isNormal,
              title: p.title
            }))
          })
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Ошибка AI')

        if (data?.result && typeof data.result === 'object') {
          setAiTrend(data.result as AiTrendResult)
          if (typeof data?.raw === 'string') setAiTrendRaw(data.raw)
        } else {
          setAiTrendRaw(typeof data?.response === 'string' ? data.response : JSON.stringify(data))
        }
      }

      if (mode === 'plan') {
        const prompt = `Составь план действий по моим документам и СОЗДАЙ напоминания.\nПлан должен быть на 2–4 недели, 3–7 пунктов.\nУчитывай показатель "${selectedIndicator}" и его динамику.\nВключи контрольные сроки/повторный анализ/консультацию (если нужно).`
        const res = await fetch('/api/ai/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: prompt,
            history: [],
            documentIds: docIds
          })
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Ошибка AI')
        setAiPlanText(data?.response || '')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      if (mode === 'trend') setAiTrendRaw(`Ошибка: ${msg}`)
      if (mode === 'plan') setAiPlanText(`Ошибка: ${msg}`)
    } finally {
      setAiBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="web-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Необходима авторизация</h1>
          <p className="text-muted-foreground mb-4">Для просмотра анализов необходимо войти в систему</p>
          <Link href="/login">
            <Button>Войти</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="web-container">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка анализов...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="web-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Ошибка</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchAnalyses}>Попробовать снова</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="web-container">
      <div className="web-hero mb-8">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="web-kicker mb-4">
            <TrendingUp className="h-4 w-4" />
            Лабораторные показатели
          </div>
          <h1 className="web-page-title">Мои анализы</h1>
          <p className="web-page-subtitle">Просмотр, динамика и AI-интерпретация результатов по категориям.</p>
        </div>
            <Link href="/documents">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Добавить анализ
              </Button>
            </Link>
        </div>
      </div>

      {/* Динамика показателей + AI */}
      {indicatorNames.length > 0 && (
        <Card className="web-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Динамика показателей
            </CardTitle>
            <CardDescription>Выберите показатель — увидите изменения по времени и получите AI‑интерпретацию.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Показатель</label>
                <select
                  value={selectedIndicator}
                  onChange={(e) => setSelectedIndicator(e.target.value)}
                  className="w-full"
                >
                  {indicatorNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiBusy}
                  onClick={() => callAI('trend')}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  ИИ‑интерпретация
                </Button>
                <Button
                  size="sm"
                  disabled={aiBusy}
                  onClick={() => callAI('plan')}
                  className="flex items-center gap-2"
                >
                  <Bell className="h-4 w-4" />
                  План → Напоминания
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="web-card lg:col-span-1">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Последнее значение</p>
                      <p className="text-2xl font-semibold">
                        {selectedSeries.length > 0 ? selectedSeries[selectedSeries.length - 1].value : '—'}
                        {selectedSeries.length > 0 && selectedSeries[selectedSeries.length - 1].unit ? ` ${selectedSeries[selectedSeries.length - 1].unit}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Тренд: {trendLabel}</p>
                    </div>
                    <svg width="140" height="36" viewBox="0 0 140 36" className="text-primary">
                      <path d={sparklinePath(selectedValues, 140, 36)} fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                </CardContent>
              </Card>

              <Card className="web-card lg:col-span-2">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium mb-2">История значений</div>
                  <div className="max-h-56 overflow-auto rounded-2xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-3 py-2">Дата</th>
                          <th className="text-left px-3 py-2">Значение</th>
                          <th className="text-left px-3 py-2">Документ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSeries.slice().reverse().map((p) => (
                          <tr key={`${p.analysisId}-${p.date}`} className="border-t">
                            <td className="px-3 py-2">{formatDate(p.date)}</td>
                            <td className={`px-3 py-2 ${p.isNormal === false ? 'text-red-600 font-medium' : ''}`}>
                              {p.value} {p.unit || ''}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{p.title}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {(aiTrend || aiTrendRaw || aiPlanText) && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(aiTrend || aiTrendRaw) && (
                  <Card className="web-card">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        ИИ‑интерпретация динамики
                        {aiTrend?.confidence !== undefined && (
                          <Badge variant="secondary">Уверенность: {aiTrend.confidence}%</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {aiTrend ? (
                        <div className="space-y-3 text-sm">
                          <div className="whitespace-pre-wrap">{aiTrend.tldr}</div>
                          {aiTrend.whatChanged?.length > 0 && (
                            <div>
                              <div className="font-medium mb-1">Что изменилось</div>
                              <ul className="list-disc pl-5 space-y-1">
                                {aiTrend.whatChanged.slice(0, 5).map((x, idx) => (
                                  <li key={idx}>{x}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiTrend.possibleCauses?.length > 0 && (
                            <div>
                              <div className="font-medium mb-1">Возможные причины</div>
                              <ul className="list-disc pl-5 space-y-1">
                                {aiTrend.possibleCauses.slice(0, 5).map((c, idx) => (
                                  <li key={idx}>
                                    {c.cause}
                                    {c.likelihood ? ` (${c.likelihood})` : ''}
                                    {c.why ? ` — ${c.why}` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiTrend.nextSteps?.length > 0 && (
                            <div>
                              <div className="font-medium mb-1">Что делать дальше</div>
                              <ul className="list-disc pl-5 space-y-1">
                                {aiTrend.nextSteps.slice(0, 6).map((x, idx) => (
                                  <li key={idx}>{x}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiTrend.questionsToRefine?.length > 0 && (
                            <div className="text-muted-foreground">
                              <div className="font-medium text-foreground mb-1">Чтобы уточнить</div>
                              <ul className="list-disc pl-5 space-y-1">
                                {aiTrend.questionsToRefine.slice(0, 5).map((x, idx) => (
                                  <li key={idx}>{x}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">{aiTrendRaw}</div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {aiPlanText && (
                  <Card className="web-card">
                    <CardHeader>
                      <CardTitle className="text-base">План действий → Напоминания</CardTitle>
                      <CardDescription>
                        Напоминания создаются автоматически. Откройте раздел{' '}
                        <Link href="/reminders" className="text-primary hover:underline">
                          Напоминания
                        </Link>
                        .
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap text-sm">{aiPlanText}</div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Фильтры и поиск */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="web-search-field flex-1">
            <Search className="web-search-icon h-4 w-4" />
            <Input
              placeholder="Поиск по названию, типу или лаборатории..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="web-search-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-44"
            >
              <option value="all">Все статусы</option>
              <option value="normal">Норма</option>
              <option value="abnormal">Отклонение</option>
              <option value="critical">Критично</option>
            </select>
          </div>
        </div>
      </div>

      {analyses.length === 0 ? (
            <Card className="web-card">
              <CardContent className="text-center py-12">
                <div className="web-icon-bubble mx-auto mb-4 h-14 w-14">
                  <FileText className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Анализы не найдены</h3>
                <p className="text-muted-foreground mb-4">Загрузите документ с анализом для автоматического распознавания</p>
                <Link href="/documents">
                  <Button>Загрузить документ</Button>
                </Link>
              </CardContent>
            </Card>
      ) : categorizedAnalyses.length === 0 ? (
        <Card className="web-card">
          <CardContent className="text-center py-12">
            <div className="web-icon-bubble mx-auto mb-4 h-14 w-14">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ничего не найдено</h3>
            <p className="text-muted-foreground mb-4">Попробуйте изменить параметры поиска или загрузите новый документ</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => { setSearchTerm(''); setStatusFilter('all') }}>
                Сбросить фильтры
              </Button>
              <Link href="/documents">
                <Button variant="outline">Загрузить документ</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categorizedAnalyses.map((category) => {
            const isExpanded = expandedCategories.has(category.name)
            const totalAnalyses = category.analyses.length
            const abnormalCount = category.analyses.filter(a => a.status !== 'normal').length
            
            return (
              <Card key={category.name} className="web-card overflow-hidden">
                <CardHeader 
                  className="cursor-pointer transition-colors hover:bg-muted/60"
                  onClick={() => toggleCategory(category.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className={`p-2 rounded-lg ${category.color}`}>
                        {category.icon}
                      </div>
                      <div>
                        <CardTitle className="text-xl">{category.name}</CardTitle>
                        <CardDescription>
                          {totalAnalyses} анализов
                          {abnormalCount > 0 && (
                            <span className="text-orange-600 ml-2">
                              ({abnormalCount} с отклонениями)
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={category.color}>
                      {totalAnalyses}
                    </Badge>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="grid gap-4">
                      {category.analyses.map((analysis) => {
                        const results = parseAnalysisResults(analysis.results)
                        return (
                          <Card key={analysis.id} className="web-card border-l-4 border-l-primary/25 shadow-none transition-shadow hover:shadow-medical">
                            <CardContent className="p-5">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h4 className="font-semibold text-lg">{analysis.title}</h4>
                                  <p className="text-sm text-muted-foreground">{analysis.type}</p>
                                </div>
                                <Badge className={getStatusColor(analysis.status)}>
                                  {getStatusText(analysis.status)}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <span>{formatDate(analysis.date)}</span>
                                </div>
                                {analysis.laboratory && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span className="truncate">{analysis.laboratory}</span>
                                  </div>
                                )}
                                {analysis.doctor && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span className="truncate">{analysis.doctor}</span>
                                  </div>
                                )}
                              </div>

                              {Object.keys(results).length > 0 && (
                                <div className="mb-4">
                                  <h5 className="font-medium mb-2 text-sm">Основные показатели:</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(results).slice(0, 4).map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-sm">
                                        <span className="font-medium">{key}:</span>
                                        <span className={value.normal === false ? 'text-red-600 font-medium' : ''}>
                                          {value.value} {value.unit}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  {Object.keys(results).length > 4 && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      И еще {Object.keys(results).length - 4} показателей...
                                    </p>
                                  )}
                                </div>
                              )}

                              {analysis.notes && (
                                <div className="mb-4">
                                  <h5 className="font-medium mb-1 text-sm">Примечания:</h5>
                                  <p className="text-sm text-muted-foreground">{analysis.notes}</p>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <Link href={`/analyses/${analysis.id}`}>
                                  <Button variant="outline" size="sm">
                                    Подробнее
                                  </Button>
                                </Link>
                                {analysis.documentId && (
                                  <Link href={`/documents/${analysis.documentId}`}>
                                    <Button variant="outline" size="sm">
                                      Исходный документ
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
