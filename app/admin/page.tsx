'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Activity, 
  Users, 
  FileText, 
  Bell, 
  TrendingUp,
  Building2,
  Heart,
  Settings,
  BarChart3,
  Shield,
  Database,
  Eye,
  BookOpen
} from 'lucide-react'
import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  totalDocuments: number
  totalAnalyses: number
  totalReminders: number
  totalRecommendations: number
  totalCompanies: number
  recentUsers: any[]
  recentDocuments: any[]
}

export default function AdminPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  const isAdmin = !!(user && user.role === 'ADMIN')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    } else if (!isLoading && user && !isAdmin) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router, isAdmin])

  useEffect(() => {
    const fetchAdminStats = async () => {
      if (!user || !isAdmin) return
      
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        if (!token) return

        const response = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching admin stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAdminStats()
  }, [user, isAdmin])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка админ-панели...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="web-page">
      <main className="web-container">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary mb-6 shadow-medical">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient-brand">
            Админ-панель
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Управление системой Персонального Медицинского Ассистента
          </p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Пользователи</p>
                    <p className="text-3xl font-bold text-gradient-brand">
                      {stats.totalUsers}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Всего зарегистрировано</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Документы</p>
                    <p className="text-3xl font-bold text-gradient-brand">
                      {stats.totalDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Загружено файлов</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Анализы</p>
                    <p className="text-3xl font-bold text-gradient-brand">
                      {stats.totalAnalyses}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Обработано анализов</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Напоминания</p>
                    <p className="text-3xl font-bold text-gradient-brand">
                      {stats.totalReminders}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Активных напоминаний</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Bell className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Рекомендации</p>
                    <p className="text-3xl font-bold text-gradient-brand">
                      {stats.totalRecommendations}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Сгенерировано</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Heart className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Компании</p>
                    <p className="text-3xl font-bold text-gradient-brand">
                      {stats.totalCompanies}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">В каталоге</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Management Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/users" className="block group">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 cursor-pointer h-full group-hover:scale-105">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <div className="w-2 h-2 bg-medical-blue rounded-full"></div>
                </div>
                <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">Управление пользователями</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Просмотр, редактирование и управление пользователями системы
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full gradient-primary text-white hover:opacity-90 transition-opacity shadow-medical">
                  <Eye className="mr-2 h-4 w-4" />
                  Управлять
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/users/roles" className="block group">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 cursor-pointer h-full group-hover:scale-105">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Settings className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                </div>
                <CardTitle className="text-xl mb-2 group-hover:text-purple-600 transition-colors">Управление ролями</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Назначение ролей пользователям: Пациент, Врач, Администратор
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity shadow-medical">
                  <Shield className="mr-2 h-4 w-4" />
                  Управлять ролями
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/documents" className="block group">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 cursor-pointer h-full group-hover:scale-105">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <div className="w-2 h-2 bg-medical-emerald rounded-full"></div>
                </div>
                <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">Документы и анализы</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Управление загруженными документами и результатами анализов
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full gradient-primary text-white hover:opacity-90 transition-opacity shadow-medical">
                  <Database className="mr-2 h-4 w-4" />
                  Управлять
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/reminders" className="block group">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 cursor-pointer h-full group-hover:scale-105">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Bell className="h-8 w-8 text-primary" />
                  </div>
                  <div className="w-2 h-2 bg-medical-amber rounded-full animate-pulse"></div>
                </div>
                <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">Напоминания</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Просмотр и управление напоминаниями всех пользователей
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full gradient-primary text-white hover:opacity-90 transition-opacity shadow-medical">
                  <Bell className="mr-2 h-4 w-4" />
                  Управлять
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/knowledge" className="block group">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 cursor-pointer h-full group-hover:scale-105">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 group-hover:scale-110 transition-transform duration-300">
                    <BookOpen className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                </div>
                <CardTitle className="text-xl mb-2 group-hover:text-indigo-600 transition-colors">База знаний</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Справочник исследований, показателей и нормативов по методологиям
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:opacity-90 transition-opacity shadow-medical">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Управлять
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/analytics" className="block group">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 cursor-pointer h-full group-hover:scale-105">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="h-8 w-8 text-primary" />
                  </div>
                  <div className="w-2 h-2 bg-medical-green rounded-full"></div>
                </div>
                <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">Аналитика</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Детальная аналитика использования системы
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full gradient-primary text-white hover:opacity-90 transition-opacity shadow-medical">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Просмотреть
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/settings" className="block group">
            <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300 cursor-pointer h-full group-hover:scale-105">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Settings className="h-8 w-8 text-primary" />
                  </div>
                  <div className="w-2 h-2 bg-medical-red rounded-full"></div>
                </div>
                <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">Настройки системы</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Конфигурация системы и глобальные настройки
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full gradient-primary text-white hover:opacity-90 transition-opacity shadow-medical">
                  <Settings className="mr-2 h-4 w-4" />
                  Настроить
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Activity */}
        {stats && (stats.recentUsers.length > 0 || stats.recentDocuments.length > 0) && (
          <div className="mt-8">
            <Card className="glass-effect border-0 shadow-medical">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gradient-brand">
                  Последняя активность
                </CardTitle>
                <CardDescription className="text-base">Недавние действия в системе</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {stats.recentUsers.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-800">Новые пользователи</h4>
                      <div className="space-y-3">
                        {stats.recentUsers.slice(0, 3).map((user: any) => (
                          <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50/50 to-green-50/50 border border-blue-100/50">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.recentDocuments.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-800">Недавние документы</h4>
                      <div className="space-y-3">
                        {stats.recentDocuments.slice(0, 3).map((doc: any) => (
                          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/50 border border-green-100/50">
                            <div className="p-2 rounded-lg bg-green-100/50">
                              <FileText className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-800">{doc.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {(doc.fileSize / 1024).toFixed(1)} KB • {doc.fileType}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(doc.uploadDate).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
