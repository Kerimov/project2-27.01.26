'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  ArrowLeft
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

interface TimeSlot {
  time: string
  timeString: string
  available: boolean
}

interface AvailableSlots {
  doctor: Doctor
  date: string
  availableSlots: TimeSlot[]
}

export default function AppointmentsPage() {
  const { user: currentUser, isLoading, token } = useAuth()
  const router = useRouter()
  
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlots | null>(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [appointmentType, setAppointmentType] = useState('consultation')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [booking, setBooking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const isPatient = !!(currentUser && currentUser.role === 'PATIENT')

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push('/login')
    } else if (!isLoading && currentUser && !isPatient) {
      router.push('/dashboard')
    }
  }, [currentUser, isLoading, router, isPatient])

  useEffect(() => {
    const fetchDoctors = async () => {
      if (!token || !isPatient) return
      
      try {
        const response = await fetch('/api/doctors', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setDoctors(data.doctors)
        }
      } catch (error) {
        console.error('Error fetching doctors:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDoctors()
  }, [token, isPatient])

  const fetchAvailableSlots = async (doctorId: string, date: string) => {
    if (!token) return
    
    try {
      setLoadingSlots(true)
      const response = await fetch(`/api/appointments/available-slots?doctorId=${doctorId}&date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAvailableSlots(data)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Ошибка при получении доступных слотов' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при получении доступных слотов' })
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId)
    setSelectedDoctor(doctor || null)
    setAvailableSlots(null)
    setSelectedTime('')
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setSelectedTime('')
    
    if (selectedDoctor && date) {
      fetchAvailableSlots(selectedDoctor.id, date)
    }
  }

  const handleBookAppointment = async () => {
    if (!token || !selectedDoctor || !selectedTime) return

    try {
      setBooking(true)
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          scheduledAt: selectedTime,
          appointmentType: appointmentType,
          notes: notes || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMessage({ type: 'success', text: 'Запись на прием создана успешно!' })
        
        // Сбрасываем форму
        setSelectedDoctor(null)
        setSelectedDate('')
        setSelectedTime('')
        setAvailableSlots(null)
        setNotes('')
        
        // Обновляем доступные слоты
        if (selectedDoctor && selectedDate) {
          fetchAvailableSlots(selectedDoctor.id, selectedDate)
        }
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Ошибка при создании записи' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при создании записи' })
    } finally {
      setBooking(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!isPatient) {
    return null
  }

  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 30) // Можно записаться на 30 дней вперед
  const maxDateString = maxDate.toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <main className="container py-8">
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
                Запись к врачу
              </h1>
              <p className="text-muted-foreground">
                Выберите врача, дату и время для записи на прием
              </p>
            </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Selection */}
          <div className="space-y-6">
            {/* Doctor Selection */}
            <Card className="glass-effect border-0 shadow-medical">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Выбор врача
                </CardTitle>
                <CardDescription>
                  Выберите врача для записи на прием
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="doctor">Врач</Label>
                  <Select onValueChange={handleDoctorChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите врача" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map(doctor => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{doctor.name}</span>
                            <span className="text-sm text-muted-foreground">{doctor.specialization}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDoctor && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">{selectedDoctor.name}</h4>
                    <div className="space-y-1 text-sm text-blue-700">
                      <p><strong>Специализация:</strong> {selectedDoctor.specialization}</p>
                      <p><strong>Опыт:</strong> {selectedDoctor.experience} лет</p>
                      {selectedDoctor.clinic && (
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {selectedDoctor.clinic}
                        </p>
                      )}
                      {selectedDoctor.phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedDoctor.phone}
                        </p>
                      )}
                      {selectedDoctor.consultationFee && (
                        <p><strong>Стоимость приема:</strong> {selectedDoctor.consultationFee} ₽</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Date Selection */}
            <Card className="glass-effect border-0 shadow-medical">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Выбор даты
                </CardTitle>
                <CardDescription>
                  Выберите дату для записи
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="date">Дата</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={today}
                    max={maxDateString}
                    disabled={!selectedDoctor}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Time Selection */}
            {selectedDate && (
              <Card className="glass-effect border-0 shadow-medical">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Выбор времени
                  </CardTitle>
                  <CardDescription>
                    Выберите доступное время (слоты по 15 минут)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSlots ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Загрузка доступных слотов...</p>
                    </div>
                  ) : availableSlots ? (
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.availableSlots.map((slot) => (
                        <Button
                          key={slot.time}
                          variant={slot.available ? "outline" : "ghost"}
                          size="sm"
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className={`h-10 ${
                            selectedTime === slot.time
                              ? 'bg-primary text-primary-foreground'
                              : slot.available
                              ? 'hover:bg-primary/10'
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          {slot.timeString}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Выберите дату для просмотра доступных слотов</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Appointment Details */}
          <div className="space-y-6">
            {/* Appointment Type */}
            <Card className="glass-effect border-0 shadow-medical">
              <CardHeader>
                <CardTitle>Детали приема</CardTitle>
                <CardDescription>
                  Укажите тип приема и дополнительные сведения
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentType">Тип приема</Label>
                  <Select value={appointmentType} onValueChange={setAppointmentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Консультация</SelectItem>
                      <SelectItem value="follow_up">Повторный прием</SelectItem>
                      <SelectItem value="routine">Плановый осмотр</SelectItem>
                      <SelectItem value="emergency">Срочный прием</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Дополнительные сведения (необязательно)</Label>
                  <Input
                    id="notes"
                    placeholder="Опишите причину обращения или симптомы"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Booking Summary */}
            {selectedDoctor && selectedDate && selectedTime && (
              <Card className="glass-effect border-0 shadow-medical bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-green-900">Подтверждение записи</CardTitle>
                  <CardDescription className="text-green-700">
                    Проверьте данные перед подтверждением
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-green-600" />
                    <span className="text-sm"><strong>Врач:</strong> {selectedDoctor.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <span className="text-sm"><strong>Дата:</strong> {new Date(selectedDate).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm"><strong>Время:</strong> {new Date(selectedTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{appointmentType}</Badge>
                  </div>
                  
                  <Button
                    onClick={handleBookAppointment}
                    disabled={booking}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white"
                  >
                    {booking ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Запись...
                      </>
                    ) : (
                      'Подтвердить запись'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
