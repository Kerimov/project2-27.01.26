'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, MapPin, User, FileText, Edit, Trash2, ShieldAlert, Sparkles, Bell } from 'lucide-react'
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
  results: string | object // JSON string or object from API
  normalRange?: string
  status: 'normal' | 'abnormal' | 'critical'
  notes?: string
  createdAt: string
  updatedAt: string
  documentId?: string
}

export default function AnalysisDetailPage() {
  const { user, token } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<string | null>(null)
  const [generatingReminders, setGeneratingReminders] = useState(false)
  const [riskLoading, setRiskLoading] = useState(false)
  const [risk, setRisk] = useState<{ level: 'ok' | 'attention' | 'urgent'; confidence: number; reasons: string[]; redFlags: string[]; nextSteps: string[] } | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planResult, setPlanResult] = useState<{ message: string; reminders: any[] } | null>(null)
  const [doctorReportLoading, setDoctorReportLoading] = useState(false)
  const [doctorReportDocId, setDoctorReportDocId] = useState<string | null>(null)

  useEffect(() => {
    if (token && params.id) {
      fetchAnalysis()
    }
  }, [token, params.id])

  useEffect(() => {
    if (!analysis || !token) return
    // обновляем triage при смене анализа
    void fetchRisk()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.id])

  const fetchAnalysis = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/analyses/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Анализ не найден')
        }
        throw new Error('Ошибка при загрузке анализа')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const fetchRisk = async () => {
    if (!analysis || !token) return
    try {
      setRiskLoading(true)
      const res = await fetch('/api/ai/risk-triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ analysisId: analysis.id, symptoms: '' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка триажа')
      setRisk(data)
    } catch (e) {
      // не блокируем страницу, просто не покажем triage
      setRisk(null)
    } finally {
      setRiskLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!analysis || !confirm('Вы уверены, что хотите удалить этот анализ?')) {
      return
    }

    try {
      setDeleting(true)
      const response = await fetch(`/api/analyses/${analysis.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Ошибка при удалении анализа')
      }

      router.push('/analyses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setDeleting(false)
    }
  }

  const handleGenerate = async () => {
    if (!analysis) return
    try {
      setGenerating(true)
      setError(null)
      const res = await fetch(`/api/analyses/${analysis.id}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка генерации комментариев')
      }
      const data = await res.json()
      setGenerated(data.comment)
      // обновим анализ
      await fetchAnalysis()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateReminders = async () => {
    if (!analysis || !token) {
      console.log('Missing analysis or token:', { analysis: !!analysis, token: !!token })
      return
    }
    try {
      setGeneratingReminders(true)
      setError(null)
      console.log('Sending request with token:', token ? 'present' : 'missing')
      const res = await fetch(`/api/analyses/${analysis.id}/reminders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка генерации напоминаний')
      }
      const data = await res.json()
      alert(`Создано ${data.reminders?.length || 0} напоминаний на основе результатов анализа!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setGeneratingReminders(false)
    }
  }

  const handleGenerateCarePlan = async () => {
    if (!analysis || !token) return
    try {
      setPlanLoading(true)
      setError(null)
      setPlanResult(null)
      const res = await fetch('/api/ai/care-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          goal: ''
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка формирования плана')
      setPlanResult({ message: data?.message || 'План создан', reminders: data?.reminders || [] })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      setError(msg)
    } finally {
      setPlanLoading(false)
    }
  }

  const handleGenerateDoctorReport = async () => {
    if (!analysis || !token) return
    try {
      setDoctorReportLoading(true)
      setError(null)
      setDoctorReportDocId(null)
      const res = await fetch('/api/reports/doctor-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          days: 180,
          complaints: '',
          medications: ''
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка формирования отчёта')
      setDoctorReportDocId(data?.documentId || null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      setError(msg)
    } finally {
      setDoctorReportLoading(false)
    }
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

  const getRiskBadge = () => {
    // fallback по status, если triage не готов
    const level = risk?.level || (analysis?.status === 'critical' ? 'urgent' : analysis?.status === 'abnormal' ? 'attention' : 'ok')
    const label = level === 'urgent' ? 'Срочно' : level === 'attention' ? 'Внимание' : 'Ок'
    const cls =
      level === 'urgent'
        ? 'bg-red-100 text-red-800'
        : level === 'attention'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-green-100 text-green-800'
    return <Badge className={cls}>{label}</Badge>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const parseAnalysisResults = (resultsString: string | object): AnalysisResult => {
    try {
      // Если это уже объект, используем его напрямую
      let parsed = resultsString
      if (typeof resultsString === 'string') {
        parsed = JSON.parse(resultsString)
      }
      
      // Если это объект с indicators, извлекаем их
      if (parsed && typeof parsed === 'object' && 'indicators' in parsed && Array.isArray(parsed.indicators)) {
        const result: AnalysisResult = {}
        parsed.indicators.forEach((indicator: any) => {
          if (indicator.name) {
            result[indicator.name] = {
              value: indicator.value || '',
              unit: indicator.unit || '',
              normal: indicator.isNormal !== false
            }
          }
        })
        return result
      }
      // Если это уже готовый объект результатов
      return parsed as AnalysisResult
    } catch (error) {
      console.error('Error parsing analysis results:', error)
      return {}
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
          <p className="mt-4 text-muted-foreground">Загрузка анализа...</p>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="web-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Ошибка</h1>
          <p className="text-muted-foreground mb-4">{error || 'Анализ не найден'}</p>
          <Link href="/analyses">
            <Button>Вернуться к списку</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="web-container">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/analyses">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{analysis.title}</h1>
          <p className="text-muted-foreground mt-2">{analysis.type}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/analyses/${analysis.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Редактировать
            </Button>
          </Link>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Генерация...' : 'Сгенерировать комментарии'}
          </Button>
          <Button size="sm" onClick={handleGenerateCarePlan} disabled={planLoading} className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {planLoading ? 'План...' : 'Сформировать план'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleGenerateDoctorReport} disabled={doctorReportLoading} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {doctorReportLoading ? 'Отчёт...' : 'Сформировать для врача'}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleGenerateReminders} 
            disabled={generatingReminders}
          >
            {generatingReminders ? 'Создание...' : 'Создать напоминания'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Основная информация */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Основная информация
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Дата анализа:</span>
                  <span>{formatDate(analysis.date)}</span>
                </div>
                
                {analysis.laboratory && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Лаборатория:</span>
                    <span>{analysis.laboratory}</span>
                  </div>
                )}
                
                {analysis.doctor && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Врач:</span>
                    <span>{analysis.doctor}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <span className="font-medium">Статус:</span>
                  <Badge className={`ml-2 ${getStatusColor(analysis.status)}`}>
                    {getStatusText(analysis.status)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Риск:</span>
                  {getRiskBadge()}
                  {riskLoading && <span className="text-xs text-muted-foreground">оценка...</span>}
                  {risk?.confidence !== undefined && (
                    <span className="text-xs text-muted-foreground">уверенность {risk.confidence}%</span>
                  )}
                </div>
                
                {analysis.normalRange && (
                  <div>
                    <span className="font-medium">Нормальные значения:</span>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.normalRange}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Триаж: причины/красные флаги */}
        {risk && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Сигналы риска и триаж
              </CardTitle>
              <CardDescription>Классификация: {risk.level}. Это не диагноз, а подсказка по приоритету.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="font-medium mb-2">Почему так</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {(risk.reasons || []).slice(0, 6).map((x, idx) => (
                      <li key={idx}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium mb-2">Когда срочно</div>
                  {risk.redFlags?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {risk.redFlags.slice(0, 6).map((x, idx) => (
                        <li key={idx} className="text-red-700">{x}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Нет явных красных флагов по имеющимся данным.</p>
                  )}
                </div>
              </div>
              {risk.nextSteps?.length ? (
                <div className="mt-4">
                  <div className="font-medium mb-2">Что делать дальше</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {risk.nextSteps.slice(0, 6).map((x, idx) => (
                      <li key={idx}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* План действий -> напоминания */}
        {planResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                План действий → Напоминания
              </CardTitle>
              <CardDescription>{planResult.message}. Управление — в разделе <Link href="/reminders" className="text-primary hover:underline">Напоминания</Link>.</CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(planResult.reminders) && planResult.reminders.length > 0 ? (
                <div className="space-y-2">
                  {planResult.reminders.slice(0, 7).map((r: any) => (
                    <div key={r.id || r.title} className="p-3 border rounded-md">
                      <div className="font-medium">{r.title}</div>
                      {r.description ? <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.description}</div> : null}
                      {r.dueAt ? <div className="text-xs text-muted-foreground mt-1">Срок: {new Date(r.dueAt).toLocaleDateString('ru-RU')}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">План сформирован, но напоминания не созданы (проверьте данные и попробуйте снова).</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Отчёт для врача */}
        {doctorReportDocId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Отчёт для врача готов
              </CardTitle>
              <CardDescription>Откройте и скачайте/распечатайте перед приёмом.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/documents/${doctorReportDocId}`} className="text-primary hover:underline">
                Открыть отчёт
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Результаты анализов */}
        {(() => {
          const results = parseAnalysisResults(analysis.results);
          return results && Object.keys(results).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Результаты анализов</CardTitle>
                <CardDescription>Показатели и их значения</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(results).map(([key, value]) => {
                    if (!value) return null;
                    
                    return (
                      <div
                        key={key}
                        className={`p-4 border rounded-lg ${
                          value.normal === false ? 'border-red-200 bg-red-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{key}</h4>
                            <p className={`text-lg font-medium ${
                              value.normal === false ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {value.value} {value.unit}
                            </p>
                          </div>
                          {value.normal === false && (
                            <Badge className="bg-red-100 text-red-800">
                              Отклонение
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

            {/* Примечания */}
            {analysis.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Примечания</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysis.notes.split('--- AI Комментарии ---').map((section, index) => {
                      if (index === 0 && section.trim()) {
                        // Обычные примечания
                        return (
                          <div key="manual">
                            <p className="text-gray-700 whitespace-pre-wrap">{section.trim()}</p>
                          </div>
                        )
                      } else if (index === 1 && section.trim()) {
                        // AI комментарии
                        return (
                          <div key="ai" className="p-3 border rounded-md bg-blue-50">
                            <h4 className="font-semibold text-blue-800 mb-2">AI Комментарии</h4>
                            <p className="text-gray-800 whitespace-pre-wrap">{section.trim()}</p>
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

        {/* Метаинформация */}
        <Card>
          <CardHeader>
            <CardTitle>Информация о записи</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Создано:</span>
                <p>{formatDate(analysis.createdAt)}</p>
              </div>
              <div>
                <span className="font-medium">Обновлено:</span>
                <p>{formatDate(analysis.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
