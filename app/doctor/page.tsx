'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Users, 
  FileText, 
  Calendar, 
  Stethoscope, 
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  UserPlus,
  FilePlus,
  CalendarPlus
} from 'lucide-react'
import Link from 'next/link'
import { CLINICAL_PROTOCOLS } from '@/lib/clinical-protocols'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface DoctorStats {
  totalPatients: number
  activePatients: number
  todayAppointments: number
  pendingAppointments: number
  totalPrescriptions: number
  activePrescriptions: number
  recentPatients: any[]
  upcomingAppointments: any[]
  urgentNotes: any[]
}

export default function DoctorDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DoctorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [doctorAppointments, setDoctorAppointments] = useState<any[]>([])
  const [day, setDay] = useState<any[] | null>(null)
  const [dayError, setDayError] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportMarkdown, setReportMarkdown] = useState<string>('')
  const [reportBusyId, setReportBusyId] = useState<string | null>(null)

  const [patients, setPatients] = useState<Array<{ id: string; name: string; email?: string }>>([])
  const [protocolPatientId, setProtocolPatientId] = useState<string>('')
  const [protocolKey, setProtocolKey] = useState<string>('hypertension')
  const [protocolStart, setProtocolStart] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [protocolNote, setProtocolNote] = useState<string>('')
  const [protocolBusy, setProtocolBusy] = useState<boolean>(false)

  const [requestPatientId, setRequestPatientId] = useState<string>('')
  const [requestAppointmentId, setRequestAppointmentId] = useState<string>('')
  const [requestNote, setRequestNote] = useState<string>('')
  const [requestBusy, setRequestBusy] = useState<boolean>(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
      return
    }

    if (user) {
      checkDoctorProfile()
    }
  }, [user, isLoading, router])

  const checkDoctorProfile = async () => {
    try {
      // Если у пользователя роль не DOCTOR — сразу направляем в онбординг
      if (user?.role !== 'DOCTOR') {
        router.push('/doctor/setup')
        return
      }

      // Передаём токен, чтобы не зависеть от cookie
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const token = lsToken || undefined

      const response = await fetch('/api/doctor/profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include'
      })
      
      if (response.ok) {
        fetchDoctorStats()
      } else {
        router.push('/doctor/setup')
      }
    } catch (error) {
      console.error('Error checking doctor profile:', error)
      router.push('/doctor/setup')
    }
  }

  const fetchDoctorStats = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const response = await fetch('/api/doctor/stats', { headers, credentials: 'include' })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
      // Параллельно подтягиваем все будущие приемы врача из отдельного эндпоинта
      try {
        const apptsRes = await fetch('/api/doctor/appointments', { headers, credentials: 'include' })
        if (apptsRes.ok) {
          const { appointments } = await apptsRes.json()
          const all = Array.isArray(appointments) ? appointments.slice() : []
          all.sort((a: any, b: any) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
          setDoctorAppointments(all)
        }
      } catch (e) {
        console.warn('Failed to load doctor appointments', e)
      }

      // Day view (today+tomorrow) with previsit + last analysis
      try {
        const dayRes = await fetch('/api/doctor/day', { headers, credentials: 'include' })
        const dayJson = await dayRes.json().catch(() => ({}))
        if (dayRes.ok) {
          setDay(Array.isArray(dayJson?.appointments) ? dayJson.appointments : [])
          setDayError(null)
        } else {
          setDay(null)
          setDayError(dayJson?.error || 'Ошибка загрузки дня')
        }
      } catch (e) {
        setDay(null)
        setDayError('Ошибка загрузки дня')
      }

      // Patients for protocol dropdown
      try {
        const pRes = await fetch('/api/doctor/patients', { headers, credentials: 'include' })
        const pJson = await pRes.json().catch(() => ({}))
        if (pRes.ok) {
          const list = Array.isArray(pJson?.patients) ? pJson.patients : []
          setPatients(list)
          if (!protocolPatientId && list.length === 1) setProtocolPatientId(list[0].id)
          if (!requestPatientId && list.length === 1) setRequestPatientId(list[0].id)
        }
      } catch (e) {
        // ignore
      }
    } catch (error) {
      console.error('Error fetching doctor stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const riskBadge = (status: string | null | undefined) => {
    const s = String(status || '').toLowerCase()
    if (s === 'critical') return <Badge className="bg-red-100 text-red-800">Critical</Badge>
    if (s === 'abnormal') return <Badge className="bg-yellow-100 text-yellow-800">Attention</Badge>
    if (!s) return <Badge variant="secondary">—</Badge>
    return <Badge className="bg-green-100 text-green-800">OK</Badge>
  }

  const previsitBadge = (submittedAt: any) => {
    return submittedAt
      ? <Badge className="bg-green-100 text-green-800">Pre‑visit ✓</Badge>
      : <Badge className="bg-gray-100 text-gray-800">Pre‑visit —</Badge>
  }

  async function generateReport(appointmentId: string) {
    try {
      setReportBusyId(appointmentId)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers = lsToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${lsToken}` } : { 'Content-Type': 'application/json' }
      const res = await fetch('/api/reports/doctor-summary', { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ appointmentId }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка отчёта')
      setReportMarkdown(String(data?.markdown || ''))
      setReportOpen(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setReportBusyId(null)
    }
  }

  async function openExistingReport(appointmentId: string) {
    try {
      setReportBusyId(appointmentId)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch(`/api/doctor/appointments/${appointmentId}/report`, {
        headers: lsToken ? { Authorization: `Bearer ${lsToken}` } : undefined,
        credentials: 'include'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Отчёт не найден')
      setReportMarkdown(String(data?.markdown || ''))
      setReportOpen(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setReportBusyId(null)
    }
  }

  async function applyProtocol() {
    if (!protocolPatientId) {
      alert('Выберите пациента')
      return
    }
    try {
      setProtocolBusy(true)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers = lsToken
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${lsToken}` }
        : { 'Content-Type': 'application/json' }
      const res = await fetch('/api/doctor/protocols/apply', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          patientId: protocolPatientId,
          protocolKey,
          startDate: protocolStart ? new Date(protocolStart).toISOString() : new Date().toISOString(),
          note: protocolNote || '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      alert(`Создано задач на согласование: ${data?.createdCount || 0}`)
      setProtocolNote('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setProtocolBusy(false)
    }
  }

  const upcomingForSelected = doctorAppointments
    .filter((a: any) => a?.patientId && a.patientId === requestPatientId)
    .filter((a: any) => +new Date(a.scheduledAt) > Date.now())
    .slice()
    .sort((a: any, b: any) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))

  async function createRequest(type: 'PREVISIT_QUESTIONNAIRE' | 'BP_7_DAYS' | 'UPLOAD_ANALYSIS') {
    if (!requestPatientId) {
      alert('Выберите пациента')
      return
    }
    if (type === 'PREVISIT_QUESTIONNAIRE' && !requestAppointmentId) {
      alert('Выберите приём для анкеты')
      return
    }
    try {
      setRequestBusy(true)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers = lsToken
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${lsToken}` }
        : { 'Content-Type': 'application/json' }
      const res = await fetch('/api/doctor/requests', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          patientId: requestPatientId,
          type,
          appointmentId: type === 'PREVISIT_QUESTIONNAIRE' ? requestAppointmentId : undefined,
          note: requestNote || ''
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      alert('Запрос отправлен пациенту')
      setRequestNote('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setRequestBusy(false)
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
                Личный кабинет врача
              </h1>
              <p className="text-muted-foreground mt-2">
                Добро пожаловать, доктор {user.name}
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/doctor/patients/new">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Новый пациент
                </Button>
              </Link>
              <Link href="/doctor/appointments">
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Запись на прием
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Всего пациентов</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gradient-brand">
                {stats?.totalPatients || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Активных: {stats?.activePatients || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Приемы сегодня</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {stats?.todayAppointments || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ожидают: {stats?.pendingAppointments || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Рецепты</CardTitle>
              <Stethoscope className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {stats?.totalPrescriptions || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Активных: {stats?.activePrescriptions || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical hover:shadow-medical-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Срочные заметки</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                {stats?.urgentNotes?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Требуют внимания
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Patients */}
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="text-gradient-brand">
                Последние пациенты
              </CardTitle>
              <CardDescription>
                Недавно добавленные или обновленные записи
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentPatients?.length ? (
                <div className="space-y-4">
                  {stats.recentPatients
                    .filter((p: any) => p && typeof p === 'object')
                    .map((patient: any) => (
                    <div key={patient.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                          {String(patient?.name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{patient?.name || '—'}</p>
                          <p className="text-sm text-muted-foreground">{patient.recordType}</p>
                        </div>
                      </div>
                      <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                        {patient.status === 'active' ? 'Активен' : patient.status === 'completed' ? 'Завершен' : patient.status === 'cancelled' ? 'Отменен' : patient.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Пока нет пациентов</p>
                </div>
              )}
              <div className="mt-4">
                <Link href="/doctor/patients">
                  <Button variant="outline" className="w-full">
                    <Users className="w-4 h-4 mr-2" />
                    Все пациенты
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Appointments Table */}
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Расписание приемов
              </CardTitle>
              <CardDescription>Все визиты пациентов</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-green-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Время</TableHead>
                      <TableHead>Пациент</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctorAppointments.length ? (
                      doctorAppointments.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>{new Date(a.scheduledAt).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell>{new Date(a.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>{a.patientName || '—'}</TableCell>
                          <TableCell>{a.appointmentType || '—'}</TableCell>
                          <TableCell>
                            {a.status === 'cancelled' ? (
                              <Badge className="bg-red-100 text-red-800 border border-red-200">Отменено</Badge>
                            ) : a.status === 'rescheduled' ? (
                              <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">Перенесено</Badge>
                            ) : a.status === 'confirmed' ? (
                              <Badge className="bg-green-600 text-white">Подтверждено</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 border border-green-200">Запланировано</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/doctor/patients/${a.patientId}`} className="text-primary hover:underline">Карточка</Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">Нет запланированных приемов</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex justify-end">
                <Link href="/doctor/appointments">
                  <Button variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Все приемы
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Быстрые действия
              </CardTitle>
              <CardDescription>
                Часто используемые функции
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/doctor/patients">
                  <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300">
                    <Users className="w-6 h-6 text-blue-600" />
                    <span>Пациенты</span>
                  </Button>
                </Link>
                <Link href="/doctor/analyses">
                  <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-green-50 hover:border-green-300 transition-all duration-300">
                    <FileText className="w-6 h-6 text-green-600" />
                    <span>Анализы</span>
                  </Button>
                </Link>
                <Link href="/doctor/prescriptions">
                  <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-purple-50 hover:border-purple-300 transition-all duration-300">
                    <Stethoscope className="w-6 h-6 text-purple-600" />
                    <span>Рецепты</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clinical Protocols */}
        <div className="mt-8">
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="text-gradient-brand">
                Клинические протоколы (шаблоны)
              </CardTitle>
              <CardDescription>
                Быстрые планы обследований/контроля. Создаёт задачи пациенту на согласование.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Пациент</div>
                  <Select value={protocolPatientId} onValueChange={setProtocolPatientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пациента" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.filter((p) => p && typeof p === 'object').map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p?.name || '—'}{p?.email ? ` (${p.email})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Шаблон</div>
                  <Select value={protocolKey} onValueChange={setProtocolKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите протокол" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINICAL_PROTOCOLS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Старт</div>
                  <input
                    type="date"
                    value={protocolStart}
                    onChange={(e) => setProtocolStart(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-white/60 p-4">
                <div className="text-sm font-medium mb-1">Что будет создано</div>
                <div className="text-xs text-muted-foreground mb-3">
                  {CLINICAL_PROTOCOLS.find((p) => p.key === protocolKey)?.summary || '—'}
                </div>
                <div className="space-y-2">
                  {(CLINICAL_PROTOCOLS.find((p) => p.key === protocolKey)?.items || []).map((it) => (
                    <div key={it.key} className="text-sm">
                      <div className="font-medium">{it.title}</div>
                      {it.description ? <div className="text-xs text-muted-foreground">{it.description}</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Комментарий (опционально)</div>
                <Textarea value={protocolNote} onChange={(e) => setProtocolNote(e.target.value)} placeholder="Напр. учесть сопутствующие заболевания/жалобы..." />
              </div>

              <div className="flex justify-end">
                <Button onClick={applyProtocol} disabled={protocolBusy} className="bg-primary text-primary-foreground">
                  {protocolBusy ? 'Создаю…' : 'Сформировать план (на согласование)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Communications (no chat) */}
        <div className="mt-8">
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Коммуникации (без чата)
              </CardTitle>
              <CardDescription>
                Запросить данные у пациента: анкета / давление 7 дней / загрузка анализа. Пациент увидит это в “План действий”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Пациент</div>
                  <Select value={requestPatientId} onValueChange={(v) => { setRequestPatientId(v); setRequestAppointmentId('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пациента" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.filter((p) => p && typeof p === 'object').map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p?.name || '—'}{p?.email ? ` (${p.email})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Приём (для анкеты)</div>
                  <Select
                    value={requestAppointmentId}
                    onValueChange={setRequestAppointmentId}
                    disabled={!requestPatientId || upcomingForSelected.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={upcomingForSelected.length ? 'Выберите приём' : 'Нет будущих приёмов'} />
                    </SelectTrigger>
                    <SelectContent>
                      {upcomingForSelected.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {new Date(a.scheduledAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • {a.patientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Комментарий пациенту (опционально)</div>
                <Textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Напр. внесите АД утром/вечером, прикрепите последний анализ..." />
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" disabled={requestBusy} onClick={() => createRequest('UPLOAD_ANALYSIS')}>
                  Загрузить анализ
                </Button>
                <Button variant="outline" disabled={requestBusy} onClick={() => createRequest('BP_7_DAYS')}>
                  Давление 7 дней
                </Button>
                <Button disabled={requestBusy} onClick={() => createRequest('PREVISIT_QUESTIONNAIRE')}>
                  Заполнить анкету
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Day view: Today + Tomorrow */}
        <div className="mt-8">
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="text-gradient-brand">
                День врача (сегодня + завтра)
              </CardTitle>
              <CardDescription>
                Pre‑visit анкета + быстрые действия + последний анализ пациента.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dayError && <div className="text-sm text-destructive mb-3">{dayError}</div>}
              {!day || day.length === 0 ? (
                <div className="text-sm text-muted-foreground">Нет приёмов на сегодня/завтра.</div>
              ) : (
                <div className="space-y-3">
                  {day.map((a: any) => (
                    <div key={a.id} className="p-4 rounded-lg border bg-white/70">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{a.patientName}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(a.scheduledAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • {a.appointmentType}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {previsitBadge(a?.preVisit?.submittedAt)}
                          {a?.doctorReport ? <Badge className="bg-purple-100 text-purple-800">Отчёт ✓</Badge> : <Badge className="bg-gray-100 text-gray-800">Отчёт —</Badge>}
                          {riskBadge(a?.lastAnalysis?.status)}
                        </div>
                      </div>
                      {a?.lastAnalysis ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Последний анализ: {new Date(a.lastAnalysis.date).toLocaleDateString('ru-RU')} — {a.lastAnalysis.title}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/doctor/patients/${a.patientId}`}>
                          <Button size="sm" variant="outline">Карточка</Button>
                        </Link>
                        <Link href={`/doctor/appointments/${a.id}/previsit`}>
                          <Button size="sm" variant="outline">Анкета</Button>
                        </Link>
                        {a?.doctorReport ? (
                          <Button size="sm" variant="secondary" onClick={() => openExistingReport(a.id)} disabled={reportBusyId === a.id}>
                            {reportBusyId === a.id ? 'Открываю…' : 'Открыть отчёт'}
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => generateReport(a.id)} disabled={reportBusyId === a.id}>
                            {reportBusyId === a.id ? 'Формирую…' : 'Сформировать отчёт'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Report modal */}
        {reportOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
            <Card className="w-full max-w-3xl bg-white">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Сводка к приёму (preview)</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>✕</Button>
                </div>
                <CardDescription>Можно копировать/печатать. Документ также сохранён у пациента.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 border rounded p-4 max-h-[60vh] overflow-auto">
{reportMarkdown || '—'}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
