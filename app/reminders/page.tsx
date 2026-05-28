'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { CaretakerPatientSwitcher } from '@/components/CaretakerPatientSwitcher'
import { 
  Bell, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  TrendingUp,
  Trash2,
  Edit
} from 'lucide-react'
import Link from 'next/link'

interface Reminder {
  id: string
  title: string
  description?: string
  dueAt: string
  recurrence: string
  channels: string | string[]
  analysis?: {
    id: string
    title: string
    type: string
  }
  document?: {
    id: string
    fileName: string
  }
  createdAt: string
}

export default function RemindersPage() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null)
  const [reminderForm, setReminderForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    recurrence: 'NONE',
    channels: ['EMAIL'] as string[]
  })

  const emptyReminderForm = () => ({
    title: '',
    description: '',
    dueAt: '',
    recurrence: 'NONE',
    channels: ['EMAIL'] as string[],
  })

  const toDatetimeLocalValue = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const openCreateModal = () => {
    setEditingReminderId(null)
    setReminderForm(emptyReminderForm())
    setShowFormModal(true)
  }

  const openEditModal = (reminder: Reminder) => {
    setEditingReminderId(reminder.id)
    setReminderForm({
      title: reminder.title,
      description: reminder.description || '',
      dueAt: toDatetimeLocalValue(reminder.dueAt),
      recurrence: reminder.recurrence || 'NONE',
      channels: Array.isArray(reminder.channels) ? [...reminder.channels] : ['EMAIL'],
    })
    setShowFormModal(true)
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    setEditingReminderId(null)
    setReminderForm(emptyReminderForm())
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('caretakerPatientId')
    if (stored) setPatientId(stored)
  }, [])

  function setPatientAndPersist(id: string | null) {
    setPatientId(id)
    if (typeof window === 'undefined') return
    if (id) window.localStorage.setItem('caretakerPatientId', id)
    else window.localStorage.removeItem('caretakerPatientId')
  }

  const fetchReminders = useCallback(async () => {
    try {
      if (!token) return

      const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
      const response = await fetch(`/api/reminders${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        // Парсим channels если они приходят как строка JSON
        const parsedData = data.map((reminder: any) => ({
          ...reminder,
          channels: typeof reminder.channels === 'string' 
            ? JSON.parse(reminder.channels) 
            : reminder.channels
        }))
        setReminders(parsedData)
      }
    } catch (error) {
      console.error('Ошибка загрузки напоминаний:', error)
    } finally {
      setLoading(false)
    }
  }, [patientId, token])

  useEffect(() => {
    if (user && token) {
      fetchReminders()
    }
  }, [user, token, patientId, fetchReminders])

  const markAsCompleted = async (reminderId: string) => {
    try {
      if (!token) return

      // Удаляем напоминание при выполнении (так как в схеме нет поля isCompleted)
      const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
      const response = await fetch(`/api/reminders/${reminderId}${qs}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        fetchReminders() // Обновляем список
      }
    } catch (error) {
      console.error('Ошибка обновления напоминания:', error)
    }
  }

  const deleteReminder = async (reminderId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это напоминание?')) return

    try {
      if (!token) return

      const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
      const response = await fetch(`/api/reminders/${reminderId}${qs}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        fetchReminders() // Обновляем список
      }
    } catch (error) {
      console.error('Ошибка удаления напоминания:', error)
    }
  }

  const saveReminder = async () => {
    if (!reminderForm.title || !reminderForm.dueAt) {
      alert('Заполните обязательные поля: заголовок и дату')
      return
    }

    try {
      if (!token) return

      const payload = {
        title: reminderForm.title,
        description: reminderForm.description || null,
        dueAt: new Date(reminderForm.dueAt).toISOString(),
        recurrence: reminderForm.recurrence,
        channels: reminderForm.channels,
        patientId,
      }

      const isEdit = Boolean(editingReminderId)
      const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
      const response = await fetch(
        isEdit ? `/api/reminders/${editingReminderId}${qs}` : '/api/reminders',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      if (response.ok) {
        closeFormModal()
        fetchReminders()
      } else {
        const error = await response.json()
        alert(error.error || (isEdit ? 'Ошибка обновления напоминания' : 'Ошибка создания напоминания'))
      }
    } catch (error) {
      console.error('Ошибка сохранения напоминания:', error)
      alert('Ошибка сохранения напоминания')
    }
  }

  const getRecurrenceLabel = (recurrence: string) => {
    switch (recurrence) {
      case 'DAILY': return 'Ежедневно'
      case 'WEEKLY': return 'Еженедельно'
      case 'MONTHLY': return 'Ежемесячно'
      case 'YEARLY': return 'Ежегодно'
      case 'NONE': return 'Однократно'
      default: return recurrence
    }
  }

  const getRecurrenceColor = (recurrence: string) => {
    switch (recurrence) {
      case 'DAILY': return 'bg-blue-500'
      case 'WEEKLY': return 'bg-green-500'
      case 'MONTHLY': return 'bg-yellow-500'
      case 'YEARLY': return 'bg-purple-500'
      case 'NONE': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  if (isLoading || loading) {
    return (
      <div className="web-container text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Загрузка напоминаний...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const upcomingReminders = reminders.filter(r => new Date(r.dueAt) > new Date())
  const overdueReminders = reminders.filter(r => new Date(r.dueAt) <= new Date())

  return (
    <div className="web-container">
      <div className="mb-4">
        <CaretakerPatientSwitcher selectedPatientId={patientId} onChange={setPatientAndPersist} />
      </div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Напоминания</h1>
          <p className="text-muted-foreground">
            Управляйте своими медицинскими напоминаниями
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить напоминание
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всего</p>
                <p className="text-2xl font-bold">{reminders.length}</p>
              </div>
              <Bell className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Предстоящие</p>
                <p className="text-2xl font-bold">{upcomingReminders.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Просроченные</p>
                <p className="text-2xl font-bold">{overdueReminders.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всего активных</p>
                <p className="text-2xl font-bold">{reminders.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Просроченные напоминания */}
      {overdueReminders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-red-600">Просроченные</h2>
          <div className="space-y-4">
            {overdueReminders.map((reminder) => (
              <Card key={reminder.id} className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="h-4 w-4" />
                        <h3 className="font-semibold">{reminder.title}</h3>
                        <Badge className={getRecurrenceColor(reminder.recurrence)}>
                          {getRecurrenceLabel(reminder.recurrence)}
                        </Badge>
                      </div>
                      {reminder.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {reminder.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Срок: {new Date(reminder.dueAt).toLocaleDateString('ru-RU')}</span>
                        <span>Повтор: {getRecurrenceLabel(reminder.recurrence)}</span>
                        <span>Каналы: {Array.isArray(reminder.channels) ? reminder.channels.join(', ') : reminder.channels}</span>
                        {reminder.analysis && (
                          <Link href={`/analyses/${reminder.analysis.id}`} className="text-primary hover:underline">
                            Связанный анализ
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => markAsCompleted(reminder.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Выполнено
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditModal(reminder)} title="Редактировать">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteReminder(reminder.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Предстоящие напоминания */}
      {upcomingReminders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Предстоящие</h2>
          <div className="space-y-4">
            {upcomingReminders.map((reminder) => (
              <Card key={reminder.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="h-4 w-4" />
                        <h3 className="font-semibold">{reminder.title}</h3>
                        <Badge className={getRecurrenceColor(reminder.recurrence)}>
                          {getRecurrenceLabel(reminder.recurrence)}
                        </Badge>
                      </div>
                      {reminder.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {reminder.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Срок: {new Date(reminder.dueAt).toLocaleDateString('ru-RU')}</span>
                        <span>Повтор: {getRecurrenceLabel(reminder.recurrence)}</span>
                        <span>Каналы: {Array.isArray(reminder.channels) ? reminder.channels.join(', ') : reminder.channels}</span>
                        {reminder.analysis && (
                          <Link href={`/analyses/${reminder.analysis.id}`} className="text-primary hover:underline">
                            Связанный анализ
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => markAsCompleted(reminder.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Выполнено
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditModal(reminder)} title="Редактировать">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteReminder(reminder.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}


      {/* Пустое состояние */}
      {reminders.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Нет напоминаний</h3>
            <p className="text-muted-foreground mb-4">
              Создайте свое первое напоминание для отслеживания важных медицинских событий
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить напоминание
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Модальное окно создания / редактирования */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-4">
              {editingReminderId ? 'Редактировать напоминание' : 'Создать напоминание'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Заголовок *</label>
                <input
                  type="text"
                  value={reminderForm.title}
                  onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  placeholder="Например: Прием лекарства"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea
                  value={reminderForm.description}
                  onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  rows={3}
                  placeholder="Дополнительная информация"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Дата и время *</label>
                <input
                  type="datetime-local"
                  value={reminderForm.dueAt}
                  onChange={(e) => setReminderForm({ ...reminderForm, dueAt: e.target.value })}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Повторение</label>
                <select
                  value={reminderForm.recurrence}
                  onChange={(e) => setReminderForm({ ...reminderForm, recurrence: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="NONE">Однократно</option>
                  <option value="DAILY">Ежедневно</option>
                  <option value="WEEKLY">Еженедельно</option>
                  <option value="MONTHLY">Ежемесячно</option>
                  <option value="YEARLY">Ежегодно</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Каналы уведомлений</label>
                <div className="space-y-2">
                  {['EMAIL', 'PUSH', 'SMS'].map(channel => (
                    <label key={channel} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reminderForm.channels.includes(channel)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setReminderForm({ ...reminderForm, channels: [...reminderForm.channels, channel] })
                          } else {
                            setReminderForm({
                              ...reminderForm,
                              channels: reminderForm.channels.filter((c) => c !== channel),
                            })
                          }
                        }}
                        className="mr-2"
                      />
                      {channel === 'EMAIL' && 'Email'}
                      {channel === 'PUSH' && 'Push-уведомления'}
                      {channel === 'SMS' && 'SMS'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button onClick={saveReminder} className="flex-1">
                {editingReminderId ? 'Сохранить' : 'Создать'}
              </Button>
              <Button variant="outline" onClick={closeFormModal} className="flex-1">
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
