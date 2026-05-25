'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { User, Target, Save, ShieldAlert } from 'lucide-react'

type Profile = {
  sex?: 'MALE' | 'FEMALE' | null
  birthDate?: string | null
  heightCm?: number | null
  weightKg?: number | null
  conditions?: string[] | null
  allergies?: string[] | null
  goals?: string[] | null
  notes?: string | null
}

function joinList(arr: any): string {
  if (!Array.isArray(arr)) return ''
  return arr.filter(Boolean).map(String).join(', ')
}

export default function ProfilePage() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [form, setForm] = useState<any>({
    sex: '',
    birthDate: '',
    heightCm: '',
    weightKg: '',
    conditions: '',
    allergies: '',
    goals: '',
    notes: ''
  })

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user || !token) return
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Ошибка профиля')
        const p: Profile | null = data?.profile || null
        setForm({
          sex: p?.sex || '',
          birthDate: p?.birthDate ? String(p.birthDate).slice(0, 10) : '',
          heightCm: p?.heightCm ?? '',
          weightKg: p?.weightKg ?? '',
          conditions: joinList(p?.conditions),
          allergies: joinList(p?.allergies),
          goals: joinList(p?.goals),
          notes: p?.notes || ''
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        setLoading(false)
      }
    })()
  }, [user, token])

  const completeness = useMemo(() => {
    let n = 0
    if (form.sex) n++
    if (form.birthDate) n++
    if (String(form.heightCm || '').trim()) n++
    if (String(form.weightKg || '').trim()) n++
    if (String(form.goals || '').trim()) n++
    return n
  }, [form])

  async function save() {
    if (!token) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sex: form.sex || null,
          birthDate: form.birthDate || null,
          heightCm: form.heightCm !== '' ? Number(form.heightCm) : null,
          weightKg: form.weightKg !== '' ? Number(form.weightKg) : null,
          conditions: form.conditions,
          allergies: form.allergies,
          goals: form.goals,
          notes: form.notes || null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка сохранения')
      setOk('Сохранено')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="web-page">
      <div className="web-container space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Профиль пациента</h1>
            <p className="text-muted-foreground">Заполните минимум — это улучшит динамику, план действий, триаж и RAG‑ответы.</p>
          </div>
          <Button onClick={save} disabled={saving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 bg-white/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Сводка
              </CardTitle>
              <CardDescription>Полезность AI растёт с заполнением профиля.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground">Заполнено</div>
                <Badge variant="secondary">{completeness}/5</Badge>
              </div>
              <div className="text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Данные используются только внутри вашего аккаунта и в AI‑подсказках.</span>
                </div>
              </div>
              {ok && <div className="text-green-700">{ok}</div>}
              {error && <div className="text-destructive">{error}</div>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-white/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Данные профиля и цели
              </CardTitle>
              <CardDescription>Списки вводите через запятую.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Пол</Label>
                <select
                  className="w-full border rounded h-9 px-2 text-sm"
                  value={form.sex}
                  onChange={(e) => setForm((p: any) => ({ ...p, sex: e.target.value }))}
                >
                  <option value="">Не указано</option>
                  <option value="MALE">Мужской</option>
                  <option value="FEMALE">Женский</option>
                </select>
              </div>
              <div>
                <Label>Дата рождения</Label>
                <Input type="date" value={form.birthDate} onChange={(e) => setForm((p: any) => ({ ...p, birthDate: e.target.value }))} />
              </div>
              <div>
                <Label>Рост (см)</Label>
                <Input type="number" value={form.heightCm} onChange={(e) => setForm((p: any) => ({ ...p, heightCm: e.target.value }))} placeholder="Напр. 176" />
              </div>
              <div>
                <Label>Вес (кг)</Label>
                <Input type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm((p: any) => ({ ...p, weightKg: e.target.value }))} placeholder="Напр. 78.5" />
              </div>
              <div className="md:col-span-2">
                <Label>Хронические состояния (через запятую)</Label>
                <Input value={form.conditions} onChange={(e) => setForm((p: any) => ({ ...p, conditions: e.target.value }))} placeholder="Гипертония, астма..." />
              </div>
              <div className="md:col-span-2">
                <Label>Аллергии (через запятую)</Label>
                <Input value={form.allergies} onChange={(e) => setForm((p: any) => ({ ...p, allergies: e.target.value }))} placeholder="Пенициллин..." />
              </div>
              <div className="md:col-span-2">
                <Label>Цели (через запятую)</Label>
                <Input value={form.goals} onChange={(e) => setForm((p: any) => ({ ...p, goals: e.target.value }))} placeholder="Снизить вес, улучшить сон..." />
              </div>
              <div className="md:col-span-2">
                <Label>Заметки</Label>
                <Input value={form.notes} onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Любые важные детали..." />
              </div>

              <div className="md:col-span-2 flex gap-2 pt-2">
                <Button onClick={save} disabled={saving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


