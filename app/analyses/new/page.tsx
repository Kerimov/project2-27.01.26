'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface AnalysisResult {
  [key: string]: {
    value: string | number
    unit?: string
    normal?: boolean
  }
}

export default function NewAnalysisPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    type: '',
    date: new Date().toISOString().split('T')[0],
    laboratory: '',
    doctor: '',
    normalRange: '',
    status: 'normal',
    notes: ''
  })

  const [results, setResults] = useState<AnalysisResult>({})
  const [newResult, setNewResult] = useState({
    name: '',
    value: '',
    unit: '',
    normal: true
  })

  const analysisTypes = [
    'Общий анализ крови',
    'Биохимический анализ крови',
    'Общий анализ мочи',
    'Анализ кала',
    'Гормональные исследования',
    'Иммунологические исследования',
    'Коагулограмма',
    'Липидограмма',
    'Глюкозотолерантный тест',
    'Другие'
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addResult = () => {
    if (newResult.name && newResult.value) {
      setResults(prev => ({
        ...prev,
        [newResult.name]: {
          value: newResult.value,
          unit: newResult.unit,
          normal: newResult.normal
        }
      }))
      setNewResult({ name: '', value: '', unit: '', normal: true })
    }
  }

  const removeResult = (key: string) => {
    setResults(prev => {
      const newResults = { ...prev }
      delete newResults[key]
      return newResults
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.type || !formData.date) {
      setError('Заполните все обязательные поля')
      return
    }

    if (Object.keys(results).length === 0) {
      setError('Добавьте хотя бы один результат анализа')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/analyses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          results
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка при сохранении анализа')
      }

      router.push('/analyses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="web-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Необходима авторизация</h1>
          <p className="text-muted-foreground mb-4">Для добавления анализов необходимо войти в систему</p>
          <Link href="/login">
            <Button>Войти</Button>
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
        <div>
          <h1 className="text-3xl font-bold">Добавить анализ</h1>
          <p className="text-muted-foreground mt-2">Введите данные о новом анализе</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="grid gap-6">
          {/* Основная информация */}
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>Заполните основную информацию об анализе</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Название анализа *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Например: Общий анализ крови"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Тип анализа *</Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип анализа" />
                    </SelectTrigger>
                    <SelectContent>
                      {analysisTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Дата анализа *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">Статус</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Норма</SelectItem>
                      <SelectItem value="abnormal">Отклонение</SelectItem>
                      <SelectItem value="critical">Критично</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="laboratory">Лаборатория</Label>
                  <Input
                    id="laboratory"
                    value={formData.laboratory}
                    onChange={(e) => handleInputChange('laboratory', e.target.value)}
                    placeholder="Название лаборатории"
                  />
                </div>
                <div>
                  <Label htmlFor="doctor">Врач</Label>
                  <Input
                    id="doctor"
                    value={formData.doctor}
                    onChange={(e) => handleInputChange('doctor', e.target.value)}
                    placeholder="ФИО врача"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="normalRange">Нормальные значения</Label>
                <Input
                  id="normalRange"
                  value={formData.normalRange}
                  onChange={(e) => handleInputChange('normalRange', e.target.value)}
                  placeholder="Например: 4.0-5.5 x10^12/л"
                />
              </div>

              <div>
                <Label htmlFor="notes">Примечания</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Дополнительная информация об анализе"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Результаты анализов */}
          <Card>
            <CardHeader>
              <CardTitle>Результаты анализов</CardTitle>
              <CardDescription>Добавьте показатели и их значения</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Добавление нового результата */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div>
                  <Label htmlFor="resultName">Показатель</Label>
                  <Input
                    id="resultName"
                    value={newResult.name}
                    onChange={(e) => setNewResult(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Например: Гемоглобин"
                  />
                </div>
                <div>
                  <Label htmlFor="resultValue">Значение</Label>
                  <Input
                    id="resultValue"
                    value={newResult.value}
                    onChange={(e) => setNewResult(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="Например: 145"
                  />
                </div>
                <div>
                  <Label htmlFor="resultUnit">Единица измерения</Label>
                  <Input
                    id="resultUnit"
                    value={newResult.unit}
                    onChange={(e) => setNewResult(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="Например: г/л"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" onClick={addResult} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                  </Button>
                </div>
              </div>

              {/* Список добавленных результатов */}
              {Object.keys(results).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Добавленные показатели:</h4>
                  {Object.entries(results).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{key}:</span>
                        <span className={value.normal === false ? 'text-red-600 font-medium' : ''}>
                          {value.value} {value.unit}
                        </span>
                        {value.normal === false && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            Отклонение
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeResult(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ошибка */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить анализ'}
            </Button>
            <Link href="/analyses">
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
