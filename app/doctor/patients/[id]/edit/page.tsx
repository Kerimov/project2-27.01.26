'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'

export default function DoctorPatientEditPage() {
  const params = useParams() as { id: string }
  const { user, isLoading, token } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [patient, setPatient] = useState<{ id: string; name: string; email: string } | null>(null)
  const [form, setForm] = useState({
    recordType: 'consultation',
    diagnosis: '',
    symptoms: '',
    treatment: '',
    medications: '',
    nextVisit: '',
    status: 'active'
  })

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const auth = token || lsToken
      const res = await fetch(`/api/doctor/patients/${params.id}`, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : undefined,
        credentials: 'include'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка загрузки')

      setPatient(data?.patient || null)
      const pr = data?.patientRecord || null
      setForm({
        recordType: pr?.recordType || 'consultation',
        diagnosis: pr?.diagnosis || '',
        symptoms: pr?.symptoms || '',
        treatment: pr?.treatment || '',
        medications: Array.isArray(pr?.medications) ? pr.medications.join('\n') : '',
        nextVisit: pr?.nextVisit ? new Date(pr.nextVisit).toISOString().slice(0, 16) : '',
        status: pr?.status || 'active'
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, params.id])

  const medsArray = useMemo(
    () => (form.medications || '').split('\n').map((s) => s.trim()).filter(Boolean),
    [form.medications]
  )

  async function save() {
    try {
      setSaving(true)
      setError(null)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const auth = token || lsToken
      const res = await fetch(`/api/doctor/patients/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: `Bearer ${auth}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          recordType: form.recordType,
          diagnosis: form.diagnosis || null,
          symptoms: form.symptoms || null,
          treatment: form.treatment || null,
          medications: medsArray,
          nextVisit: form.nextVisit ? new Date(form.nextVisit).toISOString() : null,
          status: form.status
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка сохранения')

      router.push(`/doctor/patients/${params.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gradient-brand">
              Редактирование пациента
            </h1>
            <p className="text-muted-foreground">
              {patient ? `${patient.name} (${patient.email})` : '—'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/doctor/patients/${params.id}`}>
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Button>
            </Link>
          </div>
        </div>

        {error && <div className="text-sm text-destructive mb-4">{error}</div>}

        <Card className="glass-effect border-0 shadow-medical max-w-3xl">
          <CardHeader>
            <CardTitle>Карточка пациента</CardTitle>
            <CardDescription>Редактируется запись врача (`PatientRecord`).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Тип записи</Label>
              <Select value={form.recordType} onValueChange={(v) => setForm((p) => ({ ...p, recordType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Консультация</SelectItem>
                  <SelectItem value="follow_up">Повторный прием</SelectItem>
                  <SelectItem value="emergency">Экстренный прием</SelectItem>
                  <SelectItem value="routine">Плановый осмотр</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Статус</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активно</SelectItem>
                  <SelectItem value="completed">Завершено</SelectItem>
                  <SelectItem value="cancelled">Отменено</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Диагноз</Label>
              <Input value={form.diagnosis} onChange={(e) => setForm((p) => ({ ...p, diagnosis: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Симптомы</Label>
              <Textarea rows={3} value={form.symptoms} onChange={(e) => setForm((p) => ({ ...p, symptoms: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Лечение</Label>
              <Textarea rows={3} value={form.treatment} onChange={(e) => setForm((p) => ({ ...p, treatment: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Назначенные лекарства (по одному в строке)</Label>
              <Textarea rows={4} value={form.medications} onChange={(e) => setForm((p) => ({ ...p, medications: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Следующий визит</Label>
              <Input type="datetime-local" value={form.nextVisit} onChange={(e) => setForm((p) => ({ ...p, nextVisit: e.target.value }))} />
            </div>

            <div className="flex justify-end">
              <Button disabled={saving} onClick={save} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


