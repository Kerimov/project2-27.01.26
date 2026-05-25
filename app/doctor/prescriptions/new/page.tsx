'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react'

type Patient = { id: string; name: string; email?: string }

type Warning = { severity?: 'high' | 'medium' | 'low'; title?: string; details?: string; recommendation?: string }

export default function NewPrescriptionPage() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()

  const [patients, setPatients] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState('')

  const [medication, setMedication] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [duration, setDuration] = useState('')
  const [instructions, setInstructions] = useState('')
  const [expiresAt, setExpiresAt] = useState('') // YYYY-MM-DD

  const [busy, setBusy] = useState(false)
  const [warningsBusy, setWarningsBusy] = useState(false)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [warningsNote, setWarningsNote] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  async function loadPatients() {
    if (!token) return
    const res = await fetch('/api/doctor/patients', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Ошибка загрузки пациентов')
    const list = Array.isArray(data?.patients) ? data.patients : []
    setPatients(list)
    if (!patientId && list.length === 1) setPatientId(list[0].id)
  }

  useEffect(() => {
    if (user && token) {
      loadPatients().catch((e) => console.warn(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token])

  const canCreate = useMemo(() => {
    return patientId && medication.trim() && dosage.trim() && frequency.trim() && duration.trim()
  }, [patientId, medication, dosage, frequency, duration])

  async function checkInteractions() {
    if (!token) return
    if (!patientId || !medication.trim()) {
      alert('Выберите пациента и укажите препарат')
      return
    }
    setWarningsBusy(true)
    setWarnings([])
    setWarningsNote(null)
    try {
      const res = await fetch('/api/doctor/prescriptions/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ patientId, medication, dosage, frequency, duration, instructions })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка проверки')
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : [])
      setWarningsNote(typeof data?.note === 'string' ? data.note : null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setWarningsBusy(false)
    }
  }

  async function createPrescription() {
    if (!token) return
    if (!canCreate) {
      alert('Заполните обязательные поля')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/doctor/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({
          patientId,
          medication,
          dosage,
          frequency,
          duration,
          instructions,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка создания')
      router.push('/doctor/prescriptions')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Новое назначение
            </h1>
            <p className="text-muted-foreground">Создать рецепт + проверить взаимодействия (MVP).</p>
          </div>
          <Link href="/doctor/prescriptions">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
          </Link>
        </div>

        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader>
            <CardTitle>Данные назначения</CardTitle>
            <CardDescription>Обязательные поля отмечены *</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Пациент *</div>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пациента" />
                </SelectTrigger>
                <SelectContent>
                  {patients.filter((p) => p && typeof p === 'object').map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p?.name || '—'}{p?.email ? ` (${p.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Препарат *</div>
                <Input value={medication} onChange={(e) => setMedication(e.target.value)} placeholder="Напр. Амлодипин" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Дозировка *</div>
                <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Напр. 5 мг" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Частота *</div>
                <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Напр. 1 раз в день" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Длительность *</div>
                <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Напр. 30 дней" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Срок (до)</div>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Инструкция</div>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Напр. после еды, не сочетать с алкоголем..." />
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={checkInteractions} disabled={warningsBusy}>
                {warningsBusy ? 'Проверяю…' : 'Проверить взаимодействия'}
              </Button>
              <Button onClick={createPrescription} disabled={busy || !canCreate}>
                {busy ? 'Создаю…' : 'Создать'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Проверка взаимодействий
            </CardTitle>
            <CardDescription>
              На основе списка лекарств пациента + активных назначений врача. {warningsNote ? warningsNote : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {warnings.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет предупреждений (или проверка ещё не запускалась).</div>
            ) : (
              warnings.map((w, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-white/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{w.title || 'Предупреждение'}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      {w.severity || '—'}
                    </div>
                  </div>
                  {w.details ? <div className="text-sm text-muted-foreground mt-1">{w.details}</div> : null}
                  {w.recommendation ? <div className="text-sm mt-2"><span className="font-medium">Рекомендация: </span>{w.recommendation}</div> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


