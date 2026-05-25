'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, CalendarPlus } from 'lucide-react'
import Link from 'next/link'

interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientEmail?: string
  scheduledAt: string
  status: string
  appointmentType?: string
}

export default function DoctorAppointmentsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isDayView, setIsDayView] = useState<boolean>(false)
  const [isMonthView, setIsMonthView] = useState<boolean>(false)
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState<boolean>(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [patients, setPatients] = useState<{id:string;name:string;email?:string}[]>([])
  const [formState, setFormState] = useState<{date: string; time: string; patientId: string; type: string;}>({ date: '', time: '09:00', patientId: '', type: 'consultation' })
  const [rescheduleFormState, setRescheduleFormState] = useState<{date: string; time: string;}>({ date: '', time: '09:00' })

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
      return
    }
    if (user) fetchAppointments()
  }, [user, isLoading])

  const fetchAppointments = async () => {
    try {
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/doctor/appointments', {
        headers: lsToken ? { Authorization: `Bearer ${lsToken}` } : undefined,
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.appointments || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (appointmentId: string, action: 'cancelled' | 'reschedule') => {
    if (action === 'cancelled') {
      try {
        const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch(`/api/doctor/appointments/${appointmentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(lsToken ? { Authorization: `Bearer ${lsToken}` } : {})
          },
          credentials: 'include',
          body: JSON.stringify({ status: 'cancelled' })
        })
        
        if (res.ok) {
          setIsViewOpen(false)
          fetchAppointments()
          alert('Запись отменена')
        } else {
          const error = await res.json().catch(() => ({ error: 'Ошибка' }))
          alert(error.error || 'Ошибка отмены записи')
        }
      } catch (error) {
        console.error('Error cancelling appointment:', error)
        alert('Ошибка сети при отмене записи')
      }
    } else if (action === 'reschedule') {
      setIsViewOpen(false)
      setIsRescheduleOpen(true)
      setRescheduleFormState({ date: '', time: '09:00' })
    }
  }

  function getWeekStart(date: Date) {
    const d = new Date(date)
    const day = (d.getDay() + 6) % 7 // 0=Mon
    d.setHours(0,0,0,0)
    d.setDate(d.getDate() - day)
    return d
  }

  function addDays(date: Date, days: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
  }

  function getMonthStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  const hours = Array.from({ length: 13 }, (_, i) => 9 + i) // 09-21
  const PX_PER_HOUR = 60
  // Список 15-минутных слотов (09:00 - 20:45)
  const timeSlots15 = Array.from({ length: 12 * 4 }, (_, i) => {
    const hour = 9 + Math.floor(i / 4)
    const minute = (i % 4) * 15
    const hh = String(hour).padStart(2, '0')
    const mm = String(minute).padStart(2, '0')
    return `${hh}:${mm}`
  })
  const days = isMonthView
    ? []
    : isDayView
      ? [new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())]
      : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function eventsForDay(day: Date) {
    const start = new Date(day); start.setHours(0,0,0,0)
    const end = new Date(day); end.setHours(23,59,59,999)
    return appointments.filter(a => {
      const t = new Date(a.scheduledAt)
      // Показываем только активные записи (не отмененные)
      return t >= start && t <= end && a.status !== 'cancelled'
    })
  }

  const monthStart = getMonthStart(selectedDate)
  const firstGridDay = getWeekStart(monthStart)
  const monthGridDays = Array.from({ length: 42 }, (_, i) => addDays(firstGridDay, i))

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка приемов...</div>
      </div>
    )
  }

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient-brand">Приемы</h1>
            <p className="text-muted-foreground">Всего: {appointments.length}</p>
          </div>
          <Button 
            onClick={() => {
              const today = new Date().toISOString().split('T')[0]
              const now = new Date()
              const hours = now.getHours()
              const minutes = Math.ceil(now.getMinutes() / 15) * 15
              const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
              setFormState({ date: today, time: timeStr, patientId: '', type: 'consultation' })
              setIsCreateOpen(true)
            }}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
          >
            <CalendarPlus className="w-4 h-4 mr-2" />
            Создать запись
          </Button>
        </div>

        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">{isMonthView ? 'Календарь (месяц)' : isDayView ? 'Календарь (день)' : 'Календарь (неделя)'}</CardTitle>
                  <CardDescription>
                    {isMonthView
                      ? selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
                      : isDayView
                        ? selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                        : `${weekStart.toLocaleDateString('ru-RU')} — ${addDays(weekStart,6).toLocaleDateString('ru-RU')}`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  if (isMonthView) setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))
                  else if (isDayView) setSelectedDate(addDays(selectedDate, -1))
                  else setWeekStart(addDays(weekStart, -7))
                }}>◀ Пред.</Button>
                <Button variant="outline" onClick={() => {
                  if (isMonthView) { const t = new Date(); setSelectedDate(new Date(t.getFullYear(), t.getMonth(), 1)) }
                  else if (isDayView) { const t = new Date(); setSelectedDate(t) }
                  else { setWeekStart(getWeekStart(new Date())) }
                }}>Сегодня</Button>
                <Button variant="outline" onClick={() => {
                  if (isMonthView) setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))
                  else if (isDayView) setSelectedDate(addDays(selectedDate, 1))
                  else setWeekStart(addDays(weekStart, 7))
                }}>След. ▶</Button>
                <Button variant={!isDayView && !isMonthView ? 'default' : 'outline'} onClick={() => { setIsDayView(false); setIsMonthView(false); setWeekStart(getWeekStart(selectedDate)) }}>Неделя</Button>
                <Button variant={isMonthView ? 'default' : 'outline'} onClick={() => { setIsMonthView(true); setIsDayView(false) }}>Месяц</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              {/* Кнопка создать удалена по требованию */}
              {!isMonthView && (
                <>
                  {/* Шапка дней */}
                  <div className="grid" style={{ gridTemplateColumns: `90px repeat(${days.length}, minmax(180px, 1fr))` }}>
                    <div></div>
                    {days.map((d, i) => (
                      <div key={i} className="px-3 py-2 text-sm font-medium text-gray-700 border-b">
                        {d.toLocaleDateString('ru-RU', { weekday: 'long' })}
                        <div className="text-xs text-muted-foreground">{d.toLocaleDateString('ru-RU')}</div>
                      </div>
                    ))}
                  </div>
                  {/* Сетка часов */}
                  <div className="grid" style={{ gridTemplateColumns: `90px repeat(${days.length}, minmax(180px, 1fr))`, height: PX_PER_HOUR*12 + 0 }}>
                    {/* Колонка часов */}
                    <div className="relative border-r">
                      {hours.map(h => (
                        <div key={h} className="h-[60px] border-b text-xs text-muted-foreground pr-2 flex items-start justify-end pt-1 bg-white">
                          {String(h).padStart(2,'0')}:00
                        </div>
                      ))}
                    </div>
                    {/* колонки дней */}
                    {days.map((d, idx) => (
                      <div key={idx} className="relative border-r bg-white">
                        {hours.map(h => (
                          <div key={h} style={{ height: PX_PER_HOUR }} className="border-b border-dashed"></div>
                        ))}
                        {/* Кликабельные слоты по 15 минут */}
                        <div className="absolute inset-0">
                          {Array.from({ length: 12 * 4 }, (_, idx) => idx).map(idx => {
                            const minutesFromStart = idx * 15
                            const top = (minutesFromStart / 60) * PX_PER_HOUR
                            const slotDate = new Date(d)
                            slotDate.setHours(9, minutesFromStart, 0, 0)
                            const dateStr = slotDate.toISOString().slice(0,10)
                            const timeStr = slotDate.toTimeString().slice(0,5)
                            return (
                              <button
                                key={`slot-${idx}`}
                                title={`${dateStr} ${timeStr}`}
                                onClick={() => { setFormState(s => ({ ...s, date: dateStr, time: timeStr })); setIsCreateOpen(true) }}
                                className="absolute left-0 right-0 hover:bg-blue-50/70 focus:bg-blue-100 transition-colors"
                                style={{ top, height: PX_PER_HOUR/4 }}
                              />
                            )
                          })}
                        </div>
                        {eventsForDay(d).map((evt) => {
                          const start = new Date(evt.scheduledAt)
                          const startMinutes = start.getHours() * 60 + start.getMinutes()
                          const rawDuration = (evt as any).duration ? (evt as any).duration : 15
                          const duration = Math.max(15, rawDuration)
                          const minutesFrom9 = Math.max(0, startMinutes - 9 * 60)
                          const slotHeight = PX_PER_HOUR / 4 // 15 минут
                          const firstSlotIndex = Math.floor(minutesFrom9 / 15)
                          const slotsCount = Math.max(1, Math.ceil(duration / 15))

                          return (
                            <button
                              key={evt.id}
                              onClick={() => { setSelectedAppointment(evt); setIsViewOpen(true) }}
                              className="absolute left-0 right-0 cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ top: firstSlotIndex * slotHeight, height: slotsCount * slotHeight }}
                            >
                              {Array.from({ length: slotsCount }).map((_, i) => {
                                const top = i * slotHeight
                                return (
                                  <div
                                    key={`${evt.id}-slot-${i}`}
                                    className="absolute left-0 right-0"
                                    style={{ top, height: slotHeight, background: 'linear-gradient(90deg,#34d399,#10b981)' }}
                                  />
                                )
                              })}
                              <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium px-1 truncate pointer-events-none">
                                {evt.patientName}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isMonthView && (
                <div className="grid gap-px border rounded-md overflow-hidden" style={{ gridTemplateColumns: 'repeat(7, minmax(160px, 1fr))' }}>
                  {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((n, i) => (
                    <div key={`h-${i}`} className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">{n}</div>
                  ))}
                  {monthGridDays.map((d, i) => {
                    const inMonth = d.getMonth() === monthStart.getMonth()
                    const dayEvents = eventsForDay(d) // Уже фильтрует отмененные записи
                    return (
                      <button
                        key={`d-${i}`}
                        onClick={() => { setSelectedDate(d); setIsMonthView(false); setIsDayView(true) }}
                        className={`text-left bg-white min-h-[120px] p-2 relative w-full ${inMonth ? '' : 'opacity-50'}`}
                      >
                        <div className="text-xs text-muted-foreground mb-1">{d.getDate()}</div>
                        <div className="space-y-1">
                          {dayEvents.slice(0,3).map(ev => (
                            <Link key={ev.id} href={`/doctor/patients/${ev.patientId}`} className="block text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 truncate">
                              {new Date(ev.scheduledAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · {ev.patientName}
                            </Link>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[11px] text-muted-foreground">+ ещё {dayEvents.length - 3}</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {/* Модалка просмотра записи */}
            {isViewOpen && selectedAppointment && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIsViewOpen(false)}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xl font-semibold">Детали записи</div>
                    <button onClick={() => setIsViewOpen(false)} className="text-muted-foreground hover:text-muted-foreground text-2xl leading-none">&times;</button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Пациент</div>
                      <div className="font-medium text-lg">{selectedAppointment.patientName}</div>
                      {selectedAppointment.patientEmail && (
                        <div className="text-sm text-muted-foreground">{selectedAppointment.patientEmail}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Дата</div>
                        <div className="font-medium">{new Date(selectedAppointment.scheduledAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Время</div>
                        <div className="font-medium">{new Date(selectedAppointment.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Тип приема</div>
                      <div className="font-medium">
                        {selectedAppointment.appointmentType === 'consultation' ? 'Консультация' :
                         selectedAppointment.appointmentType === 'follow_up' ? 'Повторный прием' :
                         selectedAppointment.appointmentType === 'routine' ? 'Плановый прием' :
                         selectedAppointment.appointmentType || 'Консультация'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Статус</div>
                      <div className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        {selectedAppointment.status === 'scheduled' ? 'Запланировано' : selectedAppointment.status === 'confirmed' ? 'Подтверждено' : selectedAppointment.status === 'completed' ? 'Завершено' : selectedAppointment.status === 'cancelled' ? 'Отменено' : selectedAppointment.status}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Button variant="outline" onClick={() => { setIsViewOpen(false); router.push(`/doctor/patients/${selectedAppointment.patientId}`) }} className="flex-1">
                      Открыть карточку пациента
                    </Button>
                    {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => handleStatusChange(selectedAppointment.id, 'reschedule')}
                          className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                        >
                          Перенос
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleStatusChange(selectedAppointment.id, 'cancelled')}
                          className="bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          Отказ
                        </Button>
                      </>
                    )}
                    <Button variant="outline" onClick={() => setIsViewOpen(false)}>
                      Закрыть
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Модалка переноса записи */}
            {isRescheduleOpen && selectedAppointment && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIsRescheduleOpen(false)}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xl font-semibold">Перенос записи</div>
                    <button onClick={() => setIsRescheduleOpen(false)} className="text-muted-foreground hover:text-muted-foreground text-2xl leading-none">&times;</button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Пациент</div>
                      <div className="font-medium">{selectedAppointment.patientName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Текущая дата и время</div>
                      <div className="font-medium">
                        {new Date(selectedAppointment.scheduledAt).toLocaleDateString('ru-RU')} в {new Date(selectedAppointment.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Новая дата</div>
                      <input 
                        type="date" 
                        className="w-full border rounded px-2 py-1" 
                        value={rescheduleFormState.date} 
                        onChange={(e) => setRescheduleFormState(s => ({ ...s, date: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Выбор времени</div>
                      <div className="text-xs text-muted-foreground mb-2">Выберите доступное время (слоты по 15 минут)</div>
                      {(() => {
                        const dateStr = rescheduleFormState.date
                        const busySet = new Set<string>()
                        if (dateStr) {
                          const [y, m, d] = dateStr.split('-').map(v => parseInt(v, 10))
                          const dayStart = new Date(y, (m - 1), d, 0, 0, 0, 0)
                          const dayEnd = new Date(y, (m - 1), d, 23, 59, 59, 999)
                          appointments
                            .filter(a => a.id !== selectedAppointment.id && a.status !== 'cancelled')
                            .forEach(a => {
                              const t = new Date(a.scheduledAt)
                              if (t >= dayStart && t <= dayEnd) {
                                const hh = String(t.getHours()).padStart(2, '0')
                                const mm = String(t.getMinutes()).padStart(2, '0')
                                busySet.add(`${hh}:${mm}`)
                              }
                            })
                        }
                        return (
                          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto pr-1">
                            {timeSlots15.map(slot => {
                              const isBusy = busySet.has(slot)
                              const isSelected = rescheduleFormState.time === slot
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setRescheduleFormState(s => ({ ...s, time: slot }))}
                                  className={`px-3 py-2 rounded border text-sm transition-colors ${
                                    isBusy
                                      ? 'bg-gray-100 text-muted-foreground border-gray-200 cursor-not-allowed'
                                      : isSelected
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white hover:bg-blue-50 border-gray-200'
                                  }`}
                                  title={isBusy ? 'Занято' : 'Свободно'}
                                >
                                  {slot}
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Button variant="outline" onClick={() => setIsRescheduleOpen(false)}>
                      Отмена
                    </Button>
                    <Button 
                      onClick={async () => {
                        try {
                          const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                          const newScheduledAt = new Date(`${rescheduleFormState.date}T${rescheduleFormState.time}:00`)
                          
                          const res = await fetch(`/api/doctor/appointments/${selectedAppointment.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(lsToken ? { Authorization: `Bearer ${lsToken}` } : {})
                            },
                            credentials: 'include',
                            body: JSON.stringify({ 
                              scheduledAt: newScheduledAt.toISOString(),
                              status: 'scheduled'
                            })
                          })
                          
                          if (res.ok) {
                            setIsRescheduleOpen(false)
                            fetchAppointments()
                            alert('Запись перенесена')
                          } else {
                            const error = await res.json().catch(() => ({ error: 'Ошибка' }))
                            alert(error.error || 'Ошибка переноса записи')
                          }
                        } catch (error) {
                          console.error('Error rescheduling appointment:', error)
                          alert('Ошибка сети при переносе записи')
                        }
                      }}
                      className="flex-1"
                    >
                      Перенести
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Простая модалка создания */}
            {isCreateOpen && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
                  <div className="text-lg font-semibold mb-2">Новая запись</div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Дата</div>
                        <input type="date" className="w-full border rounded px-2 py-1" value={formState.date} onChange={(e)=>setFormState(s=>({...s,date:e.target.value}))} />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Время</div>
                        <input type="time" className="w-full border rounded px-2 py-1" step={900} min="09:00" max="21:00" value={formState.time} onChange={(e)=>setFormState(s=>({...s,time:e.target.value}))} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Пациент</div>
                      <select
                        className="w-full border rounded px-2 py-1"
                        value={formState.patientId}
                        onChange={(e)=>setFormState(s=>({...s,patientId:e.target.value}))}
                        onFocus={async ()=>{
                          if (patients.length === 0) {
                            try {
                              const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                              const res = await fetch('/api/doctor/patients', { headers: lsToken ? { Authorization: `Bearer ${lsToken}` } : undefined, credentials: 'include' })
                              const data = await res.json().catch(()=>({patients:[]}))
                              if (Array.isArray(data.patients)) setPatients(data.patients)
                            } catch {}
                          }
                        }}
                      >
                        <option value="" disabled>Выберите пациента</option>
                        {patients
                          .filter((p: any) => p && typeof p === 'object')
                          .map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p?.name || '—'} {p?.email ? `• ${p.email}` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Тип приема</div>
                      <select className="w-full border rounded px-2 py-1" value={formState.type} onChange={(e)=>setFormState(s=>({...s,type:e.target.value}))}>
                        <option value="consultation">Консультация</option>
                        <option value="follow_up">Повторный прием</option>
                        <option value="routine">Плановый прием</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={()=>setIsCreateOpen(false)}>Отмена</Button>
                    <Button onClick={async ()=>{
                      try {
                        if (!formState.patientId) { alert('Выберите пациента'); return }
                        if (!formState.date || !formState.time) { alert('Выберите дату и время'); return }
                        const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                        const scheduledAt = new Date(`${formState.date}T${formState.time}:00`)
                        const res = await fetch('/api/doctor/appointments', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...(lsToken ? { Authorization: `Bearer ${lsToken}` } : {}) },
                          credentials: 'include',
                          body: JSON.stringify({ patientId: formState.patientId, scheduledAt, appointmentType: formState.type })
                        })
                        if (!res.ok) { const e = await res.json().catch(()=>({error:'Ошибка'})); alert(e.error || 'Ошибка'); return }
                        setIsCreateOpen(false)
                        fetchAppointments()
                      } catch (e) { console.error(e); alert('Ошибка создания') }
                    }}>Создать</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


