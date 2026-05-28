'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Calendar,
  Clock,
  User,
  Stethoscope,
  MapPin,
  Phone,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  FileText,
  X,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

interface Doctor {
  id: string
  name: string
  email: string
  specialization: string
  experience: number
  education: string
  phone?: string
  clinic?: string
  consultationFee?: number
}

interface Appointment {
  id: string
  doctorId: string
  patientId: string
  patientName: string
  patientPhone?: string
  patientEmail?: string
  appointmentType: string
  scheduledAt: string
  duration: number
  status: string
  notes?: string
  createdAt: string
  updatedAt: string
  preVisit?: {
    id: string
    submittedAt?: string | null
    updatedAt?: string | null
  } | null
  doctor: {
    id: string
    specialization: string
    experience: number
    education: string
    phone?: string
    clinic?: string
    consultationFee?: number
    user: {
      name: string
      email: string
    }
  }
}

export default function MyAppointmentsPage() {
  const { user: currentUser, isLoading, token } = useAuth()
  const router = useRouter()
  
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [rescheduleFormState, setRescheduleFormState] = useState({
    date: '',
    time: '',
    appointmentId: ''
  })
  const [updating, setUpdating] = useState<string | null>(null)

  const isPatient = !!(currentUser && currentUser.role === 'PATIENT')

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push('/login')
    } else if (!isLoading && currentUser && !isPatient) {
      router.push('/dashboard')
    }
  }, [currentUser, isLoading, router, isPatient])

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!token || !isPatient) return
      
      try {
        const response = await fetch('/api/appointments', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setAppointments(data.appointments)
        } else {
          const error = await response.json()
          setMessage({ type: 'error', text: error.error || 'Ошибка при загрузке записей' })
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'Ошибка при загрузке записей' })
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
  }, [token, isPatient])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Запланировано</Badge>
      case 'confirmed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Подтверждено</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-gray-100 text-gray-800">Завершено</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Отменено</Badge>
      case 'no_show':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Не явился</Badge>
      case 'rescheduled':
        return <Badge variant="default" className="bg-amber-100 text-amber-900">Перенесено</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getAppointmentTypeLabel = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'Консультация'
      case 'follow_up':
        return 'Повторный прием'
      case 'routine':
        return 'Плановый осмотр'
      case 'emergency':
        return 'Срочный прием'
      default:
        return type
    }
  }

  const isUpcoming = (scheduledAt: string) => new Date(scheduledAt) > new Date()

  const isCancelled = (status: string) => status === 'cancelled'

  const isActiveStatus = (status: string) =>
    status === 'scheduled' || status === 'confirmed' || status === 'rescheduled'

  const sortByScheduledAsc = (a: Appointment, b: Appointment) =>
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()

  const sortByScheduledDesc = (a: Appointment, b: Appointment) =>
    new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()

  const isWithin48h = (scheduledAt: string) => {
    const t = new Date(scheduledAt).getTime()
    const now = Date.now()
    return t > now && t - now <= 48 * 60 * 60 * 1000
  }

  const handleStatusChange = async (appointmentId: string, newStatus: string, newScheduledAt?: string) => {
    if (!token) return

    setUpdating(appointmentId)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          ...(newScheduledAt && { scheduledAt: newScheduledAt })
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Обновляем список записей
        setAppointments(prev => prev.map(app => 
          app.id === appointmentId 
            ? { ...app, status: newStatus, ...(newScheduledAt && { scheduledAt: newScheduledAt }) }
            : app
        ))
        
        setMessage({ 
          type: 'success', 
          text: newStatus === 'cancelled' ? 'Запись отменена' : 'Запись перенесена' 
        })
        
        setIsRescheduleOpen(false)
        setSelectedAppointment(null)
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка при обновлении записи' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при обновлении записи' })
    } finally {
      setUpdating(null)
    }
  }

  const openRescheduleModal = (appointment: Appointment) => {
    const appointmentDate = new Date(appointment.scheduledAt)
    setRescheduleFormState({
      date: appointmentDate.toISOString().split('T')[0],
      time: appointmentDate.toTimeString().slice(0, 5),
      appointmentId: appointment.id
    })
    setSelectedAppointment(appointment)
    setIsRescheduleOpen(true)
  }

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rescheduleFormState.date || !rescheduleFormState.time) return

    const newScheduledAt = new Date(`${rescheduleFormState.date}T${rescheduleFormState.time}`)
    handleStatusChange(rescheduleFormState.appointmentId, 'scheduled', newScheduledAt.toISOString())
  }

  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 9; hour < 21; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(time)
      }
    }
    return slots
  }

  const isSlotOccupied = (date: string, time: string) => {
    if (!selectedAppointment) return false
    
    const slotDateTime = new Date(`${date}T${time}`)
    return appointments.some(app => 
      app.id !== selectedAppointment.id &&
      app.doctorId === selectedAppointment.doctorId &&
      new Date(app.scheduledAt).getTime() === slotDateTime.getTime() &&
      app.status !== 'cancelled'
    )
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка записей...</p>
        </div>
      </div>
    )
  }

  if (!isPatient) {
    return null
  }

  const cancelledAppointments = appointments
    .filter((app) => isCancelled(app.status))
    .sort(sortByScheduledDesc)

  const upcomingAppointments = appointments
    .filter((app) => !isCancelled(app.status))
    .filter((app) => isUpcoming(app.scheduledAt) && isActiveStatus(app.status))
    .sort(sortByScheduledAsc)

  const pastAppointments = appointments
    .filter((app) => !isCancelled(app.status))
    .filter((app) => !(isUpcoming(app.scheduledAt) && isActiveStatus(app.status)))
    .sort(sortByScheduledDesc)

  const hasAnyAppointments =
    upcomingAppointments.length > 0 ||
    pastAppointments.length > 0 ||
    cancelledAppointments.length > 0

  return (
    <div className="web-page">
      <main className="web-container">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full gradient-primary shadow-medical">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient-brand">
                Мои записи
              </h1>
              <p className="text-muted-foreground">
                Управление записями на прием к врачу
              </p>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <Link href="/appointments">
              <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white">
                <Calendar className="h-4 w-4 mr-2" />
                Записаться на прием
              </Button>
            </Link>
          </div>
        </div>

        {/* Message */}
        {message && (
          <Alert className={`mb-6 ${message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Upcoming Appointments */}
        {upcomingAppointments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-900">Актуальные записи</h2>
            <div className="grid gap-4">
              {upcomingAppointments.map((appointment) => (
                <Card key={appointment.id} className="glass-effect border-0 shadow-medical">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Stethoscope className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{appointment.doctor.user.name}</h3>
                          <p className="text-sm text-muted-foreground">{appointment.doctor.specialization}</p>
                        </div>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(appointment.scheduledAt).toLocaleDateString('ru-RU', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(appointment.scheduledAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getAppointmentTypeLabel(appointment.appointmentType)}</span>
                      </div>
                    </div>

                    {appointment.doctor.clinic && (
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{appointment.doctor.clinic}</span>
                      </div>
                    )}

                    {appointment.doctor.phone && (
                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{appointment.doctor.phone}</span>
                      </div>
                    )}

                    {appointment.notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <strong>Примечание:</strong> {appointment.notes}
                        </p>
                      </div>
                    )}

                    {/* Кнопки управления записью */}
                    {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                      <div className="mt-4 flex gap-2">
                        {isWithin48h(appointment.scheduledAt) && (
                          <Link href={`/pre-visit/${appointment.id}`}>
                            <Button
                              size="sm"
                              className={
                                appointment.preVisit?.submittedAt
                                  ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                              }
                            >
                              {appointment.preVisit?.submittedAt ? 'Анкета заполнена' : 'Анкета перед визитом'}
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRescheduleModal(appointment)}
                          disabled={updating === appointment.id}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {updating === appointment.id ? 'Перенос...' : 'Перенести'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(appointment.id, 'cancelled')}
                          disabled={updating === appointment.id}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="h-4 w-4 mr-2" />
                          {updating === appointment.id ? 'Отмена...' : 'Отменить'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {upcomingAppointments.length === 0 && hasAnyAppointments && (
          <Card className="glass-effect border-0 shadow-medical mb-8">
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Нет предстоящих записей</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Актуальные визиты появятся здесь после записи к врачу
              </p>
              <Link href="/appointments">
                <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white">
                  <Calendar className="h-4 w-4 mr-2" />
                  Записаться на прием
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Past Appointments */}
        {pastAppointments.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-700">История записей</h2>
            <div className="grid gap-4">
              {pastAppointments.map((appointment) => (
                <Card key={appointment.id} className="glass-effect border-0 shadow-medical opacity-75">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Stethoscope className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{appointment.doctor.user.name}</h3>
                          <p className="text-sm text-muted-foreground">{appointment.doctor.specialization}</p>
                        </div>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(appointment.scheduledAt).toLocaleDateString('ru-RU', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(appointment.scheduledAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getAppointmentTypeLabel(appointment.appointmentType)}</span>
                      </div>
                    </div>

                    {appointment.notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <strong>Примечание:</strong> {appointment.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Cancelled Appointments */}
        {cancelledAppointments.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 text-red-900/80">Отменено</h2>
            <div className="grid gap-4">
              {cancelledAppointments.map((appointment) => (
                <Card key={appointment.id} className="glass-effect border border-red-100 shadow-medical opacity-80">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg">
                          <Stethoscope className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{appointment.doctor.user.name}</h3>
                          <p className="text-sm text-muted-foreground">{appointment.doctor.specialization}</p>
                        </div>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(appointment.scheduledAt).toLocaleDateString('ru-RU', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(appointment.scheduledAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getAppointmentTypeLabel(appointment.appointmentType)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Appointments */}
        {!hasAnyAppointments && (
          <Card className="glass-effect border-0 shadow-medical">
            <CardContent className="p-12 text-center">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">У вас пока нет записей</h3>
              <p className="text-muted-foreground mb-6">
                Запишитесь на прием к врачу, чтобы увидеть их здесь
              </p>
              <Link href="/appointments">
                <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white">
                  <Calendar className="h-4 w-4 mr-2" />
                  Записаться на прием
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Модальное окно переноса записи */}
      {isRescheduleOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Перенос записи</h3>
            
            <form onSubmit={handleRescheduleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Врач</label>
                <p className="text-gray-700">{selectedAppointment.doctor.user.name}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Текущая запись</label>
                <p className="text-gray-700">
                  {new Date(selectedAppointment.scheduledAt).toLocaleDateString('ru-RU')} в{' '}
                  {new Date(selectedAppointment.scheduledAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="date" className="block text-sm font-medium mb-2">
                  Новая дата
                </label>
                <input
                  id="date"
                  type="date"
                  value={rescheduleFormState.date}
                  onChange={(e) => setRescheduleFormState(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Новое время</label>
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {generateTimeSlots().map((time) => {
                    const isOccupied = isSlotOccupied(rescheduleFormState.date, time)
                    const isSelected = rescheduleFormState.time === time
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setRescheduleFormState(prev => ({ ...prev, time }))}
                        disabled={isOccupied}
                        className={`p-2 text-sm rounded border ${
                          isSelected
                            ? 'bg-blue-500 text-white border-blue-500'
                            : isOccupied
                            ? 'bg-gray-100 text-muted-foreground border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-700 border-border hover:bg-muted/60'
                        }`}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRescheduleOpen(false)}
                  className="flex-1"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={!rescheduleFormState.date || !rescheduleFormState.time}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Перенести
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
