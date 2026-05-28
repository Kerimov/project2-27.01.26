'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Bell, 
  Calendar, 
  FileText, 
  Heart, 
  Pill,
  TrendingUp,
  Clock,
  ChevronRight,
  ShieldAlert
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [adminDocs, setAdminDocs] = useState<any[]>([])
  const [adminLoading, setAdminLoading] = useState(true)
  const [todayMedicationsProgress, setTodayMedicationsProgress] = useState<string>('—')
  const [appointments, setAppointments] = useState<any[]>([])
  const [manualPulse, setManualPulse] = useState<string>('')
  const [journalCount, setJournalCount] = useState<number>(0)
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null)
  const isAdmin = !!(user && user.role === 'ADMIN')
  const displayFirstName = (() => {
    const fullName = user?.name?.trim() ?? ''
    if (!fullName) return ''
    const parts = fullName.split(/\s+/)
    if (parts.length >= 2) return parts[1]
    return parts[0]
  })()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const run = async () => {
      if (!user || !isAdmin) return
      try {
        setAdminLoading(true)
        const token = localStorage.getItem('token')
        if (!token) {
          setAdminLoading(false)
          return
        }
        const res = await fetch('/api/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setAdminUsers(data.users)
          setAdminDocs(data.documents)
        }
      } finally {
        setAdminLoading(false)
      }
    }
    run()
  }, [user, isAdmin])

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const token = localStorage.getItem('token')
        const apptRes = await fetch('/api/appointments', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        if (apptRes.ok) {
          const { appointments: apiAppointments } = await apptRes.json()
          const upcoming = (apiAppointments || []).filter((a: any) => new Date(a.scheduledAt) > new Date())
          upcoming.sort((a: any, b: any) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
          setAppointments(upcoming.slice(0, 5))
        }

        const docsRes = await fetch('/api/documents', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        if (docsRes.ok) {
          const docs = await docsRes.json()
          setJournalCount(Array.isArray(docs) ? docs.length : (docs?.documents?.length || 0))
        }

        const analysesRes = await fetch('/api/analyses', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        if (analysesRes.ok) {
          const data = await analysesRes.json()
          const list = Array.isArray(data?.analyses) ? data.analyses : []
          const sorted = list.slice().sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date))
          setLatestAnalysis(sorted[0] || null)
        }

        setTodayMedicationsProgress('3/5')
      } catch {
        // игнорируем ошибки отображения
      }
    }
    load()
  }, [user])

  const getRiskFromStatus = (status: string): { label: string; cls: string } => {
    const s = (status || '').toLowerCase()
    if (s === 'critical') return { label: 'Срочно', cls: 'bg-red-100 text-red-800' }
    if (s === 'abnormal') return { label: 'Внимание', cls: 'bg-yellow-100 text-yellow-800' }
    return { label: 'Ок', cls: 'bg-green-100 text-green-800' }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
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
      <main className="web-container">
        {/* Header */}
        <div className="web-hero mb-8">
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="web-kicker mb-4">Обзор</div>
              <h1 className="web-page-title">Добро пожаловать{displayFirstName ? `, ${displayFirstName}` : ''}</h1>
              <p className="web-page-subtitle">
                Краткая сводка: ближайшие приёмы, последний анализ и показатели. Разделы — в меню слева.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/documents">
                <Button variant="outline">
                  <FileText className="h-4 w-4" />
                  Документы
                </Button>
              </Link>
              <Link href="/analyses">
                <Button>
                  <TrendingUp className="h-4 w-4" />
                  Анализы
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="web-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Лекарства сегодня</p>
                  <p className="text-2xl font-semibold">{todayMedicationsProgress}</p>
                </div>
                <div className="web-icon-bubble h-10 w-10 rounded-xl"><Pill className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="web-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Пульс</p>
                  <div className="flex items-baseline gap-1">
                    <input
                      value={manualPulse}
                      onChange={(e) => setManualPulse(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="—"
                      className="w-16 bg-transparent outline-none border-b border-border text-xl font-semibold placeholder:text-muted-foreground"
                    />
                    <span className="text-xs text-muted-foreground">уд/мин</span>
                  </div>
                </div>
                <div className="web-icon-bubble h-10 w-10 rounded-xl"><Heart className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="web-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Документов</p>
                  <p className="text-2xl font-semibold">{journalCount}</p>
                </div>
                <div className="web-icon-bubble h-10 w-10 rounded-xl"><FileText className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="web-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ближайший прием</p>
                  <p className="text-sm font-semibold">
                    {appointments.length > 0 
                      ? new Date(appointments[0].scheduledAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                      : '—'}
                  </p>
                </div>
                <div className="web-icon-bubble h-10 w-10 rounded-xl"><Calendar className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Последний анализ + риск */}
          <Card className="web-card lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Последний анализ</CardTitle>
                <Link href="/analyses" className="text-xs text-muted-foreground hover:text-foreground">
                  Все →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!latestAnalysis ? (
                <div className="text-sm text-muted-foreground">Нет анализов</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{latestAnalysis.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(latestAnalysis.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                      <span className={`text-xs px-2 py-1 rounded ${getRiskFromStatus(latestAnalysis.status).cls}`}>
                        {getRiskFromStatus(latestAnalysis.status).label}
                      </span>
                    </div>
                  </div>
                  <Link href={`/analyses/${latestAnalysis.id}`} className="inline-flex items-center text-sm text-primary hover:underline">
                    Открыть <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ближайшие приемы */}
          <Card className="web-card lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Ближайшие приемы</CardTitle>
                <Link href="/my-appointments" className="text-xs text-muted-foreground hover:text-foreground">
                  Все записи →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Нет запланированных приемов
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="web-icon-bubble h-10 w-10 rounded-xl">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{a.doctorName || a.doctor?.fullName || 'Врач'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(a.scheduledAt).toLocaleDateString('ru-RU', { 
                              day: 'numeric', 
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                        {a.status === 'scheduled' ? 'Запланировано' :
                         a.status === 'confirmed' ? 'Подтверждено' :
                         a.status === 'completed' ? 'Завершено' :
                         a.status === 'cancelled' ? 'Отменено' :
                         a.status === 'rescheduled' ? 'Перенесено' :
                         'Запланировано'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="mt-6 space-y-4">
            <Card className="web-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Пользователи</CardTitle>
                <CardDescription>Управление пользователями системы</CardDescription>
              </CardHeader>
              <CardContent>
                {adminLoading ? (
                  <div className="text-sm text-muted-foreground">Загрузка...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Имя</TableHead>
                        <TableHead>Создан</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>{u.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="web-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Документы</CardTitle>
                <CardDescription>Все загруженные документы</CardDescription>
              </CardHeader>
              <CardContent>
                {adminLoading ? (
                  <div className="text-sm text-muted-foreground">Загрузка...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Файл</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Размер</TableHead>
                        <TableHead>Пользователь</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminDocs.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.fileName}</TableCell>
                          <TableCell>{d.fileType}</TableCell>
                          <TableCell className="text-muted-foreground">{(d.fileSize/1024).toFixed(1)} KB</TableCell>
                          <TableCell className="text-muted-foreground">{d.userId}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(d.uploadDate).toLocaleDateString('ru-RU')}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded ${
                              d.parsed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {d.parsed ? 'Обработан' : 'Новый'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
