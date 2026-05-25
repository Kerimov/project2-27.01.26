'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Bell, 
  Search, 
  Eye, 
  Edit,
  Trash2,
  User,
  Calendar,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'

interface Reminder {
  id: string
  title: string
  description: string
  dueAt: string
  recurrence: string
  channels: string[]
  isCompleted: boolean
  createdAt: string
  userId: string
  user: {
    name: string
    email: string
  }
  analysis?: {
    id: string
    title: string
  }
}

export default function AdminRemindersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)
  
  const isAdmin = !!(user && user.role === 'ADMIN')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    } else if (!isLoading && user && !isAdmin) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router, isAdmin])

  useEffect(() => {
    const fetchReminders = async () => {
      if (!user || !isAdmin) return
      
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        if (!token) return

        const response = await fetch('/api/admin/reminders', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setReminders(data.reminders)
        }
      } catch (error) {
        console.error('Error fetching reminders:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReminders()
  }, [user, isAdmin])

  const filteredReminders = reminders.filter(reminder => 
    reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reminder.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reminder.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это напоминание?')) return
    
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(`/api/admin/reminders/${reminderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        setReminders(reminders.filter(reminder => reminder.id !== reminderId))
      }
    } catch (error) {
      console.error('Error deleting reminder:', error)
    }
  }

  const handleToggleComplete = async (reminderId: string, isCompleted: boolean) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(`/api/admin/reminders/${reminderId}`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isCompleted: !isCompleted })
      })
      
      if (response.ok) {
        setReminders(reminders.map(reminder => 
          reminder.id === reminderId 
            ? { ...reminder, isCompleted: !isCompleted }
            : reminder
        ))
      }
    } catch (error) {
      console.error('Error updating reminder:', error)
    }
  }

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date() && !reminders.find(r => r.id === reminders.find(r => r.dueAt === dueAt)?.id)?.isCompleted
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Bell className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка напоминаний...</p>
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
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full gradient-primary shadow-medical">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient-brand">
                Управление напоминаниями
              </h1>
              <p className="text-muted-foreground">
                Просмотр и управление напоминаниями всех пользователей
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск напоминаний..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              {filteredReminders.length} напоминаний
            </Badge>
          </div>
        </div>

        {/* Reminders Table */}
        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader>
            <CardTitle className="text-xl">Список напоминаний</CardTitle>
            <CardDescription>
              Все напоминания пользователей системы
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Напоминание</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Срок выполнения</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Каналы</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReminders.map((reminder) => (
                    <TableRow key={reminder.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${reminder.isCompleted ? 'bg-green-100/50' : isOverdue(reminder.dueAt) ? 'bg-red-100/50' : 'bg-blue-100/50'}`}>
                            {reminder.isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : isOverdue(reminder.dueAt) ? (
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            ) : (
                              <Bell className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{reminder.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {reminder.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{reminder.user.name}</p>
                            <p className="text-xs text-muted-foreground">{reminder.user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm">
                              {new Date(reminder.dueAt).toLocaleDateString('ru-RU')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(reminder.dueAt).toLocaleTimeString('ru-RU', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant={reminder.isCompleted ? "default" : "secondary"}
                            className={reminder.isCompleted ? "bg-green-100 text-green-800" : isOverdue(reminder.dueAt) ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}
                          >
                            {reminder.isCompleted ? 'Выполнено' : isOverdue(reminder.dueAt) ? 'Просрочено' : 'Активно'}
                          </Badge>
                          {reminder.recurrence !== 'NONE' && (
                            <Badge variant="outline" className="text-xs">
                              {reminder.recurrence}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {reminder.channels.map((channel, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {channel}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReminder(reminder)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleComplete(reminder.id, reminder.isCompleted)}
                            className={reminder.isCompleted ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                          >
                            {reminder.isCompleted ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // TODO: Редактирование напоминания
                              alert('Функция редактирования будет добавлена')
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteReminder(reminder.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Reminder Details Modal */}
        {selectedReminder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl glass-effect border-0 shadow-medical-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Детали напоминания</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedReminder(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${selectedReminder.isCompleted ? 'bg-green-100/50' : isOverdue(selectedReminder.dueAt) ? 'bg-red-100/50' : 'bg-blue-100/50'}`}>
                      {selectedReminder.isCompleted ? (
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      ) : isOverdue(selectedReminder.dueAt) ? (
                        <AlertCircle className="h-8 w-8 text-red-600" />
                      ) : (
                        <Bell className="h-8 w-8 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedReminder.title}</h3>
                      <p className="text-muted-foreground">
                        {selectedReminder.isCompleted ? 'Выполнено' : isOverdue(selectedReminder.dueAt) ? 'Просрочено' : 'Активно'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800">Информация о напоминании</h4>
                      <div className="space-y-2">
                        <p className="text-sm">
                          <strong>Описание:</strong> {selectedReminder.description}
                        </p>
                        <p className="text-sm">
                          <strong>Срок выполнения:</strong> {new Date(selectedReminder.dueAt).toLocaleString('ru-RU')}
                        </p>
                        <p className="text-sm">
                          <strong>Повторение:</strong> {selectedReminder.recurrence}
                        </p>
                        <p className="text-sm">
                          <strong>Каналы уведомлений:</strong> {selectedReminder.channels.join(', ')}
                        </p>
                        <p className="text-sm">
                          <strong>Дата создания:</strong> {new Date(selectedReminder.createdAt).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800">Пользователь</h4>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50/50 to-green-50/50 border border-blue-100/50">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                          <span className="text-white font-semibold">
                            {selectedReminder.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{selectedReminder.user.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedReminder.user.email}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedReminder.analysis && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800">Связанный анализ</h4>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/50 border border-green-100/50">
                        <div className="p-2 rounded-lg bg-green-100/50">
                          <Calendar className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{selectedReminder.analysis.title}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: {selectedReminder.analysis.id}
                          </p>
                        </div>
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
