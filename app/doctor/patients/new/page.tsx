'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  UserPlus, 
  ArrowLeft,
  Save,
  Users
} from 'lucide-react'
import Link from 'next/link'

interface User {
  id: string
  name: string
  email: string
}

export default function NewPatient() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    patientId: '',
    recordType: 'consultation',
    diagnosis: '',
    symptoms: '',
    treatment: '',
    medications: '',
    nextVisit: ''
  })

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
      return
    }

    if (user) {
      fetchUsers()
    }
  }, [user, isLoading, router])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const medications = formData.medications 
        ? formData.medications.split('\n').map(med => med.trim()).filter(Boolean)
        : []

      const response = await fetch('/api/doctor/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          medications,
          nextVisit: formData.nextVisit || null
        })
      })

      if (response.ok) {
        router.push('/doctor/patients')
      } else {
        const error = await response.json()
        alert(error.error || 'Ошибка при создании записи о пациенте')
      }
    } catch (error) {
      console.error('Error creating patient record:', error)
      alert('Ошибка при создании записи о пациенте')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
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
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/doctor/patients">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-gradient-brand">
                Новый пациент
              </h1>
              <p className="text-muted-foreground mt-2">
                Добавьте нового пациента в вашу базу
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="text-gradient-brand">
                <UserPlus className="w-5 h-5 inline mr-2" />
                Информация о пациенте
              </CardTitle>
              <CardDescription>
                Заполните форму для создания записи о пациенте
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Выбор пациента */}
                <div className="space-y-2">
                  <Label htmlFor="patientId">Пациент *</Label>
                  <Select value={formData.patientId} onValueChange={(value) => handleInputChange('patientId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пациента" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u: any) => u && u.id && typeof u.name === 'string')
                        .map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email || '—'})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Тип записи */}
                <div className="space-y-2">
                  <Label htmlFor="recordType">Тип записи *</Label>
                  <Select value={formData.recordType} onValueChange={(value) => handleInputChange('recordType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Консультация</SelectItem>
                      <SelectItem value="follow_up">Повторный прием</SelectItem>
                      <SelectItem value="emergency">Экстренный прием</SelectItem>
                      <SelectItem value="routine">Плановый осмотр</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Диагноз */}
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Диагноз</Label>
                  <Input
                    id="diagnosis"
                    value={formData.diagnosis}
                    onChange={(e) => handleInputChange('diagnosis', e.target.value)}
                    placeholder="Введите диагноз"
                  />
                </div>

                {/* Симптомы */}
                <div className="space-y-2">
                  <Label htmlFor="symptoms">Симптомы</Label>
                  <Textarea
                    id="symptoms"
                    value={formData.symptoms}
                    onChange={(e) => handleInputChange('symptoms', e.target.value)}
                    placeholder="Опишите симптомы пациента"
                    rows={3}
                  />
                </div>

                {/* Лечение */}
                <div className="space-y-2">
                  <Label htmlFor="treatment">Лечение</Label>
                  <Textarea
                    id="treatment"
                    value={formData.treatment}
                    onChange={(e) => handleInputChange('treatment', e.target.value)}
                    placeholder="Опишите назначенное лечение"
                    rows={3}
                  />
                </div>

                {/* Лекарства */}
                <div className="space-y-2">
                  <Label htmlFor="medications">Назначенные лекарства</Label>
                  <Textarea
                    id="medications"
                    value={formData.medications}
                    onChange={(e) => handleInputChange('medications', e.target.value)}
                    placeholder="Введите лекарства по одному на строку"
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    Введите каждое лекарство с новой строки
                  </p>
                </div>

                {/* Следующий визит */}
                <div className="space-y-2">
                  <Label htmlFor="nextVisit">Следующий визит</Label>
                  <Input
                    id="nextVisit"
                    type="datetime-local"
                    value={formData.nextVisit}
                    onChange={(e) => handleInputChange('nextVisit', e.target.value)}
                  />
                </div>

                {/* Кнопки */}
                <div className="flex space-x-4 pt-6">
                  <Button
                    type="submit"
                    disabled={submitting || !formData.patientId}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить
                      </>
                    )}
                  </Button>
                  <Link href="/doctor/patients">
                    <Button type="button" variant="outline">
                      Отмена
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
