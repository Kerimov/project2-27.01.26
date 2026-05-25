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
  Stethoscope, 
  Save,
  ArrowLeft,
  GraduationCap,
  Building,
  Phone,
  MapPin,
  Clock,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'

export default function DoctorSetup() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    licenseNumber: '',
    specialization: '',
    experience: '',
    education: '',
    certifications: '',
    phone: '',
    clinic: '',
    address: '',
    consultationFee: '',
    workingHours: {
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '18:00' },
      saturday: { start: '10:00', end: '16:00' },
      sunday: { start: '', end: '' }
    }
  })

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
      return
    }
  }, [user, isLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/doctor/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          experience: parseInt(formData.experience),
          consultationFee: parseFloat(formData.consultationFee) || null
        })
      })

      if (response.ok) {
        router.push('/doctor')
      } else {
        const error = await response.json()
        alert(error.error || 'Ошибка при создании профиля врача')
      }
    } catch (error) {
      console.error('Error creating doctor profile:', error)
      alert('Ошибка при создании профиля врача')
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

  const handleWorkingHoursChange = (day: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: {
          ...prev.workingHours[day as keyof typeof prev.workingHours],
          [field]: value
        }
      }
    }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-gradient-brand">
                Настройка профиля врача
              </h1>
              <p className="text-gray-600 mt-2">
                Заполните информацию для создания профиля врача
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Основная информация */}
            <Card className="glass-effect border-0 shadow-medical">
              <CardHeader>
                <CardTitle className="text-gradient-brand">
                  <Stethoscope className="w-5 h-5 inline mr-2" />
                  Основная информация
                </CardTitle>
                <CardDescription>
                  Заполните основную информацию о вашей медицинской практике
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">Номер лицензии *</Label>
                    <Input
                      id="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                      placeholder="Введите номер лицензии"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialization">Специализация *</Label>
                    <Select value={formData.specialization} onValueChange={(value) => handleInputChange('specialization', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите специализацию" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">Терапевт</SelectItem>
                        <SelectItem value="cardiology">Кардиолог</SelectItem>
                        <SelectItem value="neurology">Невролог</SelectItem>
                        <SelectItem value="endocrinology">Эндокринолог</SelectItem>
                        <SelectItem value="gastroenterology">Гастроэнтеролог</SelectItem>
                        <SelectItem value="pulmonology">Пульмонолог</SelectItem>
                        <SelectItem value="dermatology">Дерматолог</SelectItem>
                        <SelectItem value="ophthalmology">Офтальмолог</SelectItem>
                        <SelectItem value="otolaryngology">ЛОР</SelectItem>
                        <SelectItem value="urology">Уролог</SelectItem>
                        <SelectItem value="gynecology">Гинеколог</SelectItem>
                        <SelectItem value="pediatrics">Педиатр</SelectItem>
                        <SelectItem value="psychiatry">Психиатр</SelectItem>
                        <SelectItem value="other">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experience">Опыт работы (лет) *</Label>
                    <Input
                      id="experience"
                      type="number"
                      min="0"
                      max="50"
                      value={formData.experience}
                      onChange={(e) => handleInputChange('experience', e.target.value)}
                      placeholder="Введите количество лет опыта"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="consultationFee">Стоимость консультации (руб.)</Label>
                    <Input
                      id="consultationFee"
                      type="number"
                      min="0"
                      value={formData.consultationFee}
                      onChange={(e) => handleInputChange('consultationFee', e.target.value)}
                      placeholder="Введите стоимость консультации"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="education">Образование *</Label>
                  <Textarea
                    id="education"
                    value={formData.education}
                    onChange={(e) => handleInputChange('education', e.target.value)}
                    placeholder="Опишите ваше медицинское образование"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="certifications">Сертификаты и дополнительное образование</Label>
                  <Textarea
                    id="certifications"
                    value={formData.certifications}
                    onChange={(e) => handleInputChange('certifications', e.target.value)}
                    placeholder="Перечислите сертификаты, курсы повышения квалификации и т.д."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Контактная информация */}
            <Card className="glass-effect border-0 shadow-medical">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  <Phone className="w-5 h-5 inline mr-2" />
                  Контактная информация
                </CardTitle>
                <CardDescription>
                  Укажите контактные данные и место работы
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Телефон</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clinic">Клиника/Больница</Label>
                    <Input
                      id="clinic"
                      value={formData.clinic}
                      onChange={(e) => handleInputChange('clinic', e.target.value)}
                      placeholder="Название медицинского учреждения"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Адрес</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Полный адрес места работы"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Рабочие часы */}
            <Card className="glass-effect border-0 shadow-medical">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  <Clock className="w-5 h-5 inline mr-2" />
                  Рабочие часы
                </CardTitle>
                <CardDescription>
                  Укажите ваши рабочие часы по дням недели
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(formData.workingHours).map(([day, hours]) => (
                    <div key={day} className="flex items-center space-x-4">
                      <div className="w-24 text-sm font-medium capitalize">
                        {day === 'monday' && 'Понедельник'}
                        {day === 'tuesday' && 'Вторник'}
                        {day === 'wednesday' && 'Среда'}
                        {day === 'thursday' && 'Четверг'}
                        {day === 'friday' && 'Пятница'}
                        {day === 'saturday' && 'Суббота'}
                        {day === 'sunday' && 'Воскресенье'}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="time"
                          value={hours.start}
                          onChange={(e) => handleWorkingHoursChange(day, 'start', e.target.value)}
                          className="w-32"
                        />
                        <span className="text-gray-500">-</span>
                        <Input
                          type="time"
                          value={hours.end}
                          onChange={(e) => handleWorkingHoursChange(day, 'end', e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Кнопки */}
            <div className="flex justify-end space-x-4">
              <Link href="/dashboard">
                <Button type="button" variant="outline">
                  Отмена
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={submitting || !formData.licenseNumber || !formData.specialization || !formData.experience || !formData.education}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Создание...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Создать профиль
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
