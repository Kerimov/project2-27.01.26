'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Loader2, Plus, Printer, PauseCircle, RotateCcw } from 'lucide-react'

type Prescription = {
  id: string
  patientRecordId: string
  medication: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string | null
  isActive: boolean
  prescribedAt: string
  expiresAt?: string | null
  patient?: { id: string; name: string; email: string } | null
}

export default function DoctorPrescriptionsPage() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Prescription[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  async function fetchPrescriptions() {
    try {
      setLoading(true)
      setError(null)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/doctor/prescriptions', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(lsToken && !token ? { Authorization: `Bearer ${lsToken}` } : {})
        },
        credentials: 'include'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка загрузки рецептов')
      setItems(Array.isArray(data?.prescriptions) ? data.prescriptions : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchPrescriptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-3" />
          <div className="text-muted-foreground">Загрузка рецептов…</div>
        </div>
      </div>
    )
  }

  if (!user) return null

  async function patchPrescription(id: string, body: any) {
    if (!token) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/doctor/prescriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      await fetchPrescriptions()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Рецепты</h1>
            <p className="text-muted-foreground">Список назначений из карточек пациентов.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/doctor/prescriptions/new">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Новое назначение
              </Button>
            </Link>
            <Link href="/doctor">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Button>
            </Link>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Рецепты
              </span>
              <Badge variant="secondary">{items.length}</Badge>
            </CardTitle>
            <CardDescription>Создавайте/продлевайте/закрывайте назначения и печатайте лист назначений.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока нет рецептов.</div>
            ) : (
              items.map((p) => (
                <div key={p.id} className="p-4 rounded-lg border bg-white/70 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{p.medication}</div>
                    <Badge className={p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {p.isActive ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.dosage} • {p.frequency} • {p.duration}
                  </div>
                  {p.instructions ? <div className="text-sm">{p.instructions}</div> : null}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span>Назначен: {new Date(p.prescribedAt).toLocaleDateString('ru-RU')}</span>
                    {p.expiresAt ? <span>Срок до: {new Date(p.expiresAt).toLocaleDateString('ru-RU')}</span> : null}
                    {p.patient ? (
                      <span>
                        Пациент:{' '}
                        <Link href={`/doctor/patients/${p.patient.id}`} className="text-primary hover:underline">
                          {p.patient.name}
                        </Link>
                      </span>
                    ) : null}
                  </div>
                  <div className="pt-2 flex flex-wrap gap-2">
                    {p.patient ? (
                      <Link href={`/doctor/prescriptions/print?patientId=${encodeURIComponent(p.patient.id)}`}>
                        <Button size="sm" variant="outline" className="flex items-center gap-2">
                          <Printer className="h-4 w-4" />
                          Лист назначений
                        </Button>
                      </Link>
                    ) : null}
                    {p.isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === p.id}
                        onClick={() => patchPrescription(p.id, { action: 'close' })}
                        className="flex items-center gap-2"
                      >
                        <PauseCircle className="h-4 w-4" />
                        Закрыть
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === p.id}
                        onClick={() => patchPrescription(p.id, { action: 'reopen' })}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Возобновить
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === p.id}
                      onClick={() => {
                        const d = prompt('Новый срок (YYYY-MM-DD). Можно пусто, чтобы убрать срок.') || ''
                        const iso = d.trim() ? new Date(d.trim()).toISOString() : null
                        patchPrescription(p.id, { action: 'extend', expiresAt: iso })
                      }}
                    >
                      Продлить
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


