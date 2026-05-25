'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Pill, ShieldAlert, Clock, Plus, Trash2, Sparkles, Bell } from 'lucide-react'
import { CaretakerPatientSwitcher } from '@/components/CaretakerPatientSwitcher'

type Medication = {
  id: string
  name: string
  dosage?: string | null
  frequencyPerDay?: number | null
  times?: any
  notes?: string | null
  isSupplement: boolean
  createdAt: string
}

export default function MedicationsPage() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [meds, setMeds] = useState<Medication[]>([])
  const [error, setError] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)

  const [form, setForm] = useState<any>({
    name: '',
    dosage: '',
    frequencyPerDay: 1,
    times: '',
    notes: '',
    isSupplement: false
  })

  const [planBusy, setPlanBusy] = useState(false)
  const [plan, setPlan] = useState<any | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
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

  async function fetchMeds() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
      const res = await fetch(`/api/medications${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      setMeds(Array.isArray(data?.medications) ? data.medications : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && token) fetchMeds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, patientId])

  async function createMedication() {
    if (!token) return
    if (!form.name?.trim()) return alert('Введите название')
    try {
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId,
          name: form.name,
          dosage: form.dosage || null,
          frequencyPerDay: Number(form.frequencyPerDay) || 1,
          times: form.times || undefined,
          notes: form.notes || null,
          isSupplement: !!form.isSupplement
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка создания')
      setForm({ name: '', dosage: '', frequencyPerDay: 1, times: '', notes: '', isSupplement: false })
      await fetchMeds()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  async function deleteMedication(id: string) {
    if (!token) return
    if (!confirm('Удалить препарат?')) return
    try {
      const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
      const res = await fetch(`/api/medications/${id}${qs}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка удаления')
      setMeds((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  async function generatePlanAndReminders() {
    if (!token) return
    try {
      setPlanBusy(true)
      setPlanError(null)
      setPlan(null)
      const res = await fetch('/api/ai/medications/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId,
          createReminders: true,
          channels: ['PUSH']
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка плана')
      setPlan(data?.result || null)
      await fetchMeds()
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setPlanBusy(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="web-container text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Загрузка...</p>
      </div>
    )
  }

  if (!user) return null

  const supplementsCount = meds.filter((m) => m.isSupplement).length

  const severityBadge = (sev: string) => {
    const s = String(sev || '').toLowerCase()
    if (s === 'danger') return <Badge className="bg-red-100 text-red-800">Высокий</Badge>
    if (s === 'warning') return <Badge className="bg-yellow-100 text-yellow-800">Внимание</Badge>
    return <Badge className="bg-blue-100 text-blue-800">Инфо</Badge>
  }

  return (
    <div className="web-page">
      <div className="web-container space-y-6">
        <CaretakerPatientSwitcher selectedPatientId={patientId} onChange={setPatientAndPersist} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Лекарства</h1>
            <p className="text-muted-foreground">Список препаратов/БАДов → проверка → расписание → напоминания.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/reminders">
              <Button variant="outline" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Напоминания
              </Button>
            </Link>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Всего в списке</div>
                  <div className="text-2xl font-semibold">{meds.length}</div>
                </div>
                <Pill className="h-7 w-7 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">БАДы</div>
                  <div className="text-2xl font-semibold">{supplementsCount}</div>
                </div>
                <Sparkles className="h-7 w-7 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Проверка + режим</div>
                  <div className="text-xs text-muted-foreground">создаёт ежедневные напоминания</div>
                </div>
                <ShieldAlert className="h-7 w-7 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Добавить препарат
            </CardTitle>
            <CardDescription>Введите как на упаковке (желательно МНН в скобках).</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-3">
              <Label>Название *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Напр. Метформин (metformin)" />
            </div>
            <div className="md:col-span-1">
              <Label>Дозировка</Label>
              <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500 мг" />
            </div>
            <div className="md:col-span-1">
              <Label>Раз/день</Label>
              <Input type="number" min={1} max={6} value={form.frequencyPerDay} onChange={(e) => setForm({ ...form, frequencyPerDay: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-1">
              <Label>БАД</Label>
              <div className="flex items-center gap-2 h-9">
                <input type="checkbox" checked={!!form.isSupplement} onChange={(e) => setForm({ ...form, isSupplement: e.target.checked })} />
                <span className="text-sm text-muted-foreground">Да</span>
              </div>
            </div>
            <div className="md:col-span-3">
              <Label>Время (опционально)</Label>
              <Input value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder="08:00, 20:00" />
              <div className="text-xs text-muted-foreground mt-1">Если не указать — подберём базовые времена по кратности.</div>
            </div>
            <div className="md:col-span-3">
              <Label>Заметки</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="После еды / натощак / курс..." />
            </div>
            <div className="md:col-span-6 flex gap-2">
              <Button onClick={createMedication}>Добавить</Button>
              <Button variant="outline" onClick={() => setForm({ name: '', dosage: '', frequencyPerDay: 1, times: '', notes: '', isSupplement: false })}>
                Сбросить
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Список</CardTitle>
                <CardDescription>Дальше: “Проверить” сформирует расписание и (опционально) создаст напоминания.</CardDescription>
              </div>
              <Button onClick={generatePlanAndReminders} disabled={planBusy || meds.length === 0} className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                {planBusy ? 'Проверяю...' : 'Проверить + напоминания'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {meds.length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока пусто</div>
            ) : (
              <div className="space-y-2">
                {meds.map((m) => {
                  const times = Array.isArray(m.times) ? m.times : []
                  return (
                    <div key={m.id} className="p-4 border rounded-lg bg-white/50 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium truncate">{m.name}</div>
                          {m.isSupplement ? <Badge variant="secondary">БАД</Badge> : <Badge variant="outline">Лекарство</Badge>}
                          {m.frequencyPerDay ? <Badge variant="outline">{m.frequencyPerDay}×/день</Badge> : null}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          {m.dosage ? <span>{m.dosage}</span> : null}
                          {times.length > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {times.slice(0, 6).map((t: any) => (
                                <Badge key={String(t)} variant="secondary" className="ml-1">{String(t)}</Badge>
                              ))}
                            </span>
                          ) : null}
                        </div>
                        {m.notes ? <div className="text-sm mt-2 whitespace-pre-wrap">{m.notes}</div> : null}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => deleteMedication(m.id)} className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Удалить
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {planError && <div className="text-sm text-destructive mt-4">{planError}</div>}

            {plan && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-white/60">
                  <CardHeader>
                    <CardTitle className="text-base">Результат</CardTitle>
                    <CardDescription>Кратко и по делу.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="whitespace-pre-wrap">{plan.tldr}</div>
                    {Array.isArray(plan.createdReminders) && plan.createdReminders.length > 0 && (
                      <div className="text-muted-foreground">
                        Создано напоминаний: <span className="font-medium">{plan.createdReminders.length}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/60">
                  <CardHeader>
                    <CardTitle className="text-base">Предупреждения</CardTitle>
                    <CardDescription>Проверяйте с врачом/фармацевтом.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {Array.isArray(plan.warnings) && plan.warnings.length > 0 ? (
                      <div className="space-y-2">
                        {plan.warnings.slice(0, 12).map((w: any, idx: number) => (
                          <div key={idx} className="p-3 border rounded-md bg-background/60">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium">Проверка</div>
                              {severityBadge(w?.severity)}
                            </div>
                            <div className="mt-1 text-muted-foreground">{w?.text || String(w)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Нет явных предупреждений по базовым правилам.</div>
                    )}
                  </CardContent>
                </Card>

                {Array.isArray(plan.schedule) && plan.schedule.length > 0 && (
                  <Card className="bg-white/60 lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Расписание</CardTitle>
                      <CardDescription>Времена приёма; можно править в списке и перепроверить.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="space-y-2">
                        {plan.schedule.slice(0, 20).map((s: any, idx: number) => (
                          <div key={idx} className="p-3 border rounded-md bg-background/60">
                            <div className="font-medium">{s.name}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(Array.isArray(s.times) ? s.times : []).slice(0, 6).map((t: any) => (
                                <Badge key={String(t)} variant="secondary">{String(t)}</Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Напоминания создаются в разделе <Link href="/reminders" className="text-primary hover:underline">“Напоминания”</Link>.
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


