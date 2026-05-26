'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  FileText, 
  Search, 
  Eye, 
  MessageSquare,
  Calendar,
  User,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

interface Analysis {
  id: string
  title: string
  status: string
  createdAt: string
  patient: {
    id: string
    name: string
    email: string
  }
  document?: {
    fileName: string
    studyDate: string
    laboratory: string
  }
  results?: any[]
  comments?: any[]
}

export default function DoctorAnalyses() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
      return
    }

    if (user) {
      fetchAnalyses()
    }
  }, [user, isLoading, router])

  const fetchAnalyses = async () => {
    try {
      const params = new URLSearchParams()
      // Поддерживаем фильтр по patientId из query
      const url = new URL(window.location.href)
      const patientId = url.searchParams.get('patientId')
      if (patientId) params.set('patientId', patientId)

      const response = await fetch(`/api/doctor/analyses?${params.toString()}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setAnalyses(data)
      }
    } catch (error) {
      console.error('Error fetching analyses:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis.patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.document?.laboratory && analysis.document.laboratory.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800'
      case 'abnormal': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle className="w-4 h-4" />
      case 'abnormal': return <AlertTriangle className="w-4 h-4" />
      case 'pending': return <Activity className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  if (isLoading || loading) {
    return (
      <div className="web-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gradient-brand">
                Анализы пациентов
              </h1>
              <p className="text-muted-foreground mt-2">
                Всего анализов: {analyses.length}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card className="glass-effect border-0 shadow-medical mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="web-search-field flex-1">
                <Search className="web-search-icon h-4 w-4" />
                <Input
                  placeholder="Поиск по названию, пациенту или лаборатории..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="web-search-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analyses List */}
        <div className="space-y-6">
          {filteredAnalyses.map((analysis) => (
            <Card key={analysis.id} className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{analysis.title}</CardTitle>
                      <CardDescription>
                        Пациент: {analysis.patient.name} ({analysis.patient.email})
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(analysis.status)}>
                      {getStatusIcon(analysis.status)}
                      <span className="ml-1">
                        {analysis.status === 'normal' ? 'Норма' : 
                         analysis.status === 'abnormal' ? 'Отклонение' : 
                         analysis.status === 'critical' ? 'Критично' : 
                         analysis.status}
                      </span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Дата: {new Date(analysis.createdAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  
                  {analysis.document?.laboratory && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Activity className="w-4 h-4" />
                      <span>Лаборатория: {analysis.document.laboratory}</span>
                    </div>
                  )}

                  {analysis.document?.studyDate && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Дата исследования: {new Date(analysis.document.studyDate).toLocaleDateString('ru-RU')}</span>
                    </div>
                  )}
                </div>

                {analysis.results && analysis.results.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Результаты:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {analysis.results.slice(0, 4).map((result: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm font-medium">{result.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{result.value} {result.unit}</span>
                            {result.isNormal ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                        </div>
                      ))}
                      {analysis.results.length > 4 && (
                        <div className="text-sm text-muted-foreground">
                          и еще {analysis.results.length - 4} показателей...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {analysis.comments && analysis.comments.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Комментарии:</h4>
                    <div className="space-y-2">
                      {analysis.comments.slice(0, 2).map((comment: any, index: number) => (
                        <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-sm text-gray-700">{comment.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(comment.createdAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                      ))}
                      {analysis.comments.length > 2 && (
                        <div className="text-sm text-muted-foreground">
                          и еще {analysis.comments.length - 2} комментариев...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-4">
                    <Link href={`/doctor/analyses/${analysis.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Подробнее
                      </Button>
                    </Link>
                    <Link href={`/doctor/analyses/${analysis.id}/comment`}>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Комментарий
                      </Button>
                    </Link>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ID: {analysis.id}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredAnalyses.length === 0 && (
          <Card className="glass-effect border-0 shadow-medical">
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                {searchTerm ? 'Анализы не найдены' : 'Пока нет анализов'}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? 'Попробуйте изменить поисковый запрос'
                  : 'Анализы появятся здесь после загрузки документов пациентами'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
