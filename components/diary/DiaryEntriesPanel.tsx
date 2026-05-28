'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CaretakerPatientSwitcher } from '@/components/CaretakerPatientSwitcher'

type Entry = {
  id: string
  entryDate: string
  mood?: number
  painScore?: number
  sleepHours?: number
  steps?: number
  temperature?: number
  weight?: number
  systolic?: number
  diastolic?: number
  pulse?: number
  symptoms?: string
  notes?: string
  tags: { tag: { id: string; name: string; color?: string } }[]
}

type WeeklyReview = {
  tldr: string
  whatInfluenced: string[]
  hypotheses: Array<{ hypothesis: string; evidence?: any; experiment: string }>
  questionsToImprove?: string[]
  redFlags?: string[]
  nextSteps?: string[]
  correlations?: Array<{ metric: string; target: string; r: number; n: number }>
  dataQuality?: string[]
  recentAnalyses?: Array<{ id: string; title: string; status: string; date: string; abnormalIndicators: string[] }>
}

type IndicatorOption = { name: string; count: number }

type IndicatorLinkResult = {
  indicatorName: string
  windowDays: number
  unit?: string | null
  tldr: string
  keyLinks?: string[]
  correlations?: Array<{ metric: string; r: number; n: number }>
  deltaCorrelations?: Array<{ metric: string; r: number; n: number }>
  rows?: Array<{
    analysisId: string
    analysisDate: string
    analysisTitle: string
    indicatorValue: number
    indicatorUnit?: string
    entriesCount: number
    avgs: Record<string, number | null>
  }>
  hypotheses?: Array<{ hypothesis: string; experiment: string }>
  questionsToImprove?: string[]
  cautions?: string[]
  dataQuality?: string[]
}

export function DiaryEntriesPanel() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<any>({ entryDate: new Date().toISOString().slice(0,16), mood: 3, painScore: 0, sleepHours: 8 })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [order, setOrder] = useState<'desc'|'asc'>('desc')
  const [tag, setTag] = useState('')
  const [weeklyBusy, setWeeklyBusy] = useState(false)
  const [weekly, setWeekly] = useState<WeeklyReview | null>(null)
  const [weeklyUsedLLM, setWeeklyUsedLLM] = useState<boolean | null>(null)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)

  const [indicatorOptions, setIndicatorOptions] = useState<IndicatorOption[]>([])
  const [indicatorName, setIndicatorName] = useState<string>('')
  const [indicatorWindowDays, setIndicatorWindowDays] = useState<3 | 7 | 14>(7)
  const [indicatorMode, setIndicatorMode] = useState<'level' | 'delta'>('level')
  const [indicatorBusy, setIndicatorBusy] = useState(false)
  const [indicatorError, setIndicatorError] = useState<string | null>(null)
  const [indicatorUsedLLM, setIndicatorUsedLLM] = useState<boolean | null>(null)
  const [indicatorResult, setIndicatorResult] = useState<IndicatorLinkResult | null>(null)

  const [patientId, setPatientId] = useState<string | null>(null)

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

  const uniqueTags = useMemo(() => Array.from(new Set(entries.flatMap(e => e.tags.map(t => t.tag.name)))), [entries])

  const fetchEntries = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (patientId) params.set('patientId', patientId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (tag) params.set('tag', tag)
    const res = await fetch(`/api/diary/entries?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    // Сортируем по дате (новые сверху)
    setEntries((data as Entry[]).slice().sort((a: Entry, b: Entry) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()))
    setLoading(false)
  }, [from, patientId, tag, to, token])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    if (!token) return
    // загрузим список показателей из анализов (для выбора)
    ;(async () => {
      try {
        const res = await fetch('/api/ai/diary-indicator-link', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) return
        const list: IndicatorOption[] = Array.isArray(data?.indicators) ? data.indicators : []
        setIndicatorOptions(list)
        if (!indicatorName && list.length > 0) setIndicatorName(list[0].name)
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function createEntry() {
    if (!token) return
    const payload = { ...form, patientId, tags: form.tags?.split(',').map((s: string) => s.trim()).filter(Boolean) }
    const res = await fetch('/api/diary/entries', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
    if (res.ok) {
      setForm({ entryDate: new Date().toISOString().slice(0,16), mood: 3, painScore: 0, sleepHours: 8 })
      fetchEntries()
    }
  }

  async function deleteEntry(id: string) {
    if (!token) return
    const ok = window.confirm('Удалить запись?')
    if (!ok) return
    const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
    const res = await fetch(`/api/diary/entries/${id}${qs}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      setEntries(prev => prev.filter(e => e.id !== id))
    }
  }

  async function fetchWeeklyReview() {
    if (!token) return
    try {
      setWeeklyBusy(true)
      setWeeklyError(null)
      setWeekly(null)
      setWeeklyUsedLLM(null)

      const endDate = to ? new Date(to).toISOString() : new Date().toISOString()
      const res = await fetch('/api/ai/diary-weekly-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ days: 7, endDate })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка обзора')
      setWeekly(data?.result || null)
      setWeeklyUsedLLM(!!data?.usedLLM)
    } catch (e) {
      setWeeklyError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setWeeklyBusy(false)
    }
  }

  async function fetchIndicatorLink() {
    if (!token || !indicatorName) return
    try {
      setIndicatorBusy(true)
      setIndicatorError(null)
      setIndicatorResult(null)
      setIndicatorUsedLLM(null)
      const res = await fetch('/api/ai/diary-indicator-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          indicatorName,
          windowDays: indicatorWindowDays,
          limitAnalyses: 12
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка связи')
      setIndicatorResult(data?.result || null)
      setIndicatorUsedLLM(!!data?.usedLLM)
    } catch (e) {
      setIndicatorError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setIndicatorBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
        <CaretakerPatientSwitcher selectedPatientId={patientId} onChange={setPatientAndPersist} />
      <Card className="bg-white/60">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Еженедельный обзор (ИИ)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                “Что влияло” (сон/шаги/пульс/АД ↔ боль/настроение) + 2 гипотезы и безопасные эксперименты.
              </p>
            </div>
            <Button onClick={fetchWeeklyReview} disabled={weeklyBusy}>
              {weeklyBusy ? 'Формирую...' : 'Сформировать'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {weeklyError && <div className="text-sm text-destructive">{weeklyError}</div>}
          {!weekly && !weeklyError && (
            <div className="text-sm text-muted-foreground">
              Нажмите “Сформировать”, чтобы получить обзор за последние 7 дней (по умолчанию до сегодняшнего дня).
            </div>
          )}
          {weekly && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">TL;DR</div>
                <div className="whitespace-pre-wrap">{weekly.tldr}</div>
                {weeklyUsedLLM !== null && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Режим: {weeklyUsedLLM ? 'с Ollama' : 'без Ollama (правила)'}
                  </div>
                )}
              </div>

              {Array.isArray(weekly.dataQuality) && weekly.dataQuality.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">Качество данных</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {weekly.dataQuality.slice(0, 5).map((x, idx) => <li key={idx}>{x}</li>)}
                  </ul>
                </div>
              )}

              {Array.isArray(weekly.whatInfluenced) && weekly.whatInfluenced.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">Что влияло</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {weekly.whatInfluenced.slice(0, 6).map((x, idx) => <li key={idx}>{x}</li>)}
                  </ul>
                </div>
              )}

              {Array.isArray(weekly.hypotheses) && weekly.hypotheses.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">2 гипотезы</div>
                  <div className="space-y-2">
                    {weekly.hypotheses.slice(0, 2).map((h, idx) => (
                      <div key={idx} className="p-3 border rounded-md">
                        <div className="font-medium">{h.hypothesis}</div>
                        <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{h.experiment}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(weekly.nextSteps) && weekly.nextSteps.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">Следующие шаги</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {weekly.nextSteps.slice(0, 6).map((x, idx) => <li key={idx}>{x}</li>)}
                  </ul>
                </div>
              )}

              {Array.isArray(weekly.redFlags) && weekly.redFlags.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium text-red-700">Когда стоит срочно обратиться</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {weekly.redFlags.slice(0, 5).map((x, idx) => <li key={idx} className="text-red-700">{x}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/60">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Связь дневника с показателем</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Берём значения выбранного показателя из анализов и сравниваем со средними дневника в окне до каждого анализа.
                Можно смотреть “уровни” или “дельты” (изменения между анализами).
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <select
                className="border rounded h-9 px-2 text-sm"
                value={String(indicatorWindowDays)}
                onChange={(e) => setIndicatorWindowDays(Number(e.target.value) as 3 | 7 | 14)}
              >
                <option value="3">Окно 3 дня</option>
                <option value="7">Окно 7 дней</option>
                <option value="14">Окно 14 дней</option>
              </select>
              <select
                className="border rounded h-9 px-2 text-sm"
                value={indicatorMode}
                onChange={(e) => setIndicatorMode(e.target.value as 'level' | 'delta')}
              >
                <option value="level">Уровни</option>
                <option value="delta">Дельты</option>
              </select>
              <select
                className="border rounded h-9 px-2 text-sm max-w-[320px]"
                value={indicatorName}
                onChange={(e) => setIndicatorName(e.target.value)}
                disabled={indicatorOptions.length === 0}
              >
                {indicatorOptions.length === 0 ? (
                  <option value="">Нет данных</option>
                ) : (
                  indicatorOptions.slice(0, 200).map((opt) => (
                    <option key={opt.name} value={opt.name}>
                      {opt.name} ({opt.count})
                    </option>
                  ))
                )}
              </select>
              <Button onClick={fetchIndicatorLink} disabled={indicatorBusy || !indicatorName}>
                {indicatorBusy ? 'Считаю...' : 'Показать'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {indicatorError && <div className="text-sm text-destructive">{indicatorError}</div>}
          {!indicatorResult && !indicatorError && (
            <div className="text-sm text-muted-foreground">
              Выберите показатель и нажмите “Показать”.
            </div>
          )}
          {indicatorResult && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">TL;DR</div>
                <div className="whitespace-pre-wrap">{indicatorResult.tldr}</div>
                {indicatorUsedLLM !== null && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Режим: {indicatorUsedLLM ? 'с Ollama' : 'без Ollama (правила)'}
                  </div>
                )}
              </div>

              {Array.isArray(indicatorResult.dataQuality) && indicatorResult.dataQuality.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">Качество данных</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {indicatorResult.dataQuality.slice(0, 5).map((x, idx) => <li key={idx}>{x}</li>)}
                  </ul>
                </div>
              )}

              {Array.isArray(indicatorResult.keyLinks) && indicatorResult.keyLinks.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">Ключевые связи</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {indicatorResult.keyLinks.slice(0, 6).map((x, idx) => <li key={idx}>{x}</li>)}
                  </ul>
                </div>
              )}

              {(indicatorMode === 'level') && Array.isArray(indicatorResult.correlations) && indicatorResult.correlations.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">Топ корреляции (уровни)</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {indicatorResult.correlations.slice(0, 6).map((c, idx) => (
                      <li key={idx}>
                        {c.metric}: r={c.r}, n={c.n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(indicatorMode === 'delta') && Array.isArray(indicatorResult.deltaCorrelations) && indicatorResult.deltaCorrelations.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">Топ корреляции (дельты)</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {indicatorResult.deltaCorrelations.slice(0, 6).map((c, idx) => (
                      <li key={idx}>
                        Δ{c.metric}: r={c.r}, n={c.n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(indicatorResult.hypotheses) && indicatorResult.hypotheses.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium">2 гипотезы</div>
                  <div className="space-y-2">
                    {indicatorResult.hypotheses.slice(0, 2).map((h, idx) => (
                      <div key={idx} className="p-3 border rounded-md">
                        <div className="font-medium">{h.hypothesis}</div>
                        <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{h.experiment}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(indicatorResult.rows) && indicatorResult.rows.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium mb-2">Точки (анализы) и средние дневника (окно {indicatorResult.windowDays} дней)</div>
                  <div className="max-h-64 overflow-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Дата анализа</th>
                          <th className="text-left px-3 py-2">Показатель</th>
                          <th className="text-left px-3 py-2">Сон</th>
                          <th className="text-left px-3 py-2">Боль</th>
                          <th className="text-left px-3 py-2">Настроение</th>
                          <th className="text-left px-3 py-2">Пульс</th>
                          <th className="text-left px-3 py-2">Записей</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicatorResult.rows.slice().reverse().slice(0, 12).map((r) => (
                          <tr key={r.analysisId} className="border-t">
                            <td className="px-3 py-2">{new Date(r.analysisDate).toLocaleDateString('ru-RU')}</td>
                            <td className="px-3 py-2">
                              {r.indicatorValue} {r.indicatorUnit || indicatorResult.unit || ''}
                            </td>
                            <td className="px-3 py-2">{r.avgs.sleepHours != null ? r.avgs.sleepHours.toFixed(1) : '—'}</td>
                            <td className="px-3 py-2">{r.avgs.painScore != null ? r.avgs.painScore.toFixed(1) : '—'}</td>
                            <td className="px-3 py-2">{r.avgs.mood != null ? r.avgs.mood.toFixed(1) : '—'}</td>
                            <td className="px-3 py-2">{r.avgs.pulse != null ? r.avgs.pulse.toFixed(0) : '—'}</td>
                            <td className="px-3 py-2">{r.entriesCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {Array.isArray(indicatorResult.cautions) && indicatorResult.cautions.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium text-muted-foreground">Оговорки</div>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {indicatorResult.cautions.slice(0, 5).map((x, idx) => <li key={idx}>{x}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/60">
        <CardHeader>
          <CardTitle>Новая запись</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label>Дата и время</Label>
            <Input type="datetime-local" value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} />
          </div>
          <div>
            <Label>Настроение (1-5)</Label>
            <Input type="number" min={1} max={5} value={form.mood ?? ''} onChange={e => setForm({ ...form, mood: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Боль (0-10)</Label>
            <Input type="number" min={0} max={10} value={form.painScore ?? ''} onChange={e => setForm({ ...form, painScore: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Сон (часов)</Label>
            <Input type="number" step="0.1" value={form.sleepHours ?? ''} onChange={e => setForm({ ...form, sleepHours: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Шаги</Label>
            <Input type="number" value={form.steps ?? ''} onChange={e => setForm({ ...form, steps: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Температура</Label>
            <Input type="number" step="0.1" value={form.temperature ?? ''} onChange={e => setForm({ ...form, temperature: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Вес</Label>
            <Input type="number" step="0.1" value={form.weight ?? ''} onChange={e => setForm({ ...form, weight: Number(e.target.value) })} />
          </div>
          <div>
            <Label>АД (систолическое/диастолическое)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Сист." value={form.systolic ?? ''} onChange={e => setForm({ ...form, systolic: Number(e.target.value) })} />
              <Input type="number" placeholder="Диаст." value={form.diastolic ?? ''} onChange={e => setForm({ ...form, diastolic: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Пульс</Label>
            <Input type="number" value={form.pulse ?? ''} onChange={e => setForm({ ...form, pulse: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <Label>Симптомы</Label>
            <Input value={form.symptoms ?? ''} onChange={e => setForm({ ...form, symptoms: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Заметки</Label>
            <Input value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Теги (через запятую)</Label>
            <Input value={form.tags ?? ''} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="col-span-2 md:col-span-4">
            <Button onClick={createEntry}>Записать</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/60">
        <CardHeader>
          <CardTitle>Записи</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div>
              <Label>С</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>По</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div>
              <Label>Тег</Label>
              <Input list="tags" value={tag} onChange={e => setTag(e.target.value)} />
              <datalist id="tags">
                {uniqueTags.map(t => (<option key={t} value={t} />))}
              </datalist>
            </div>
            <div>
              <Label>Сортировка</Label>
              <select className="w-full border rounded h-9 px-2" value={order} onChange={e => setOrder(e.target.value as any)}>
                <option value="desc">Новые сверху</option>
                <option value="asc">Старые сверху</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={fetchEntries}>Фильтровать</Button>
            </div>
          </div>

          <div className="space-y-3">
            {entries
              .slice()
              .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
              .map(e => (
              <div key={e.id} className="p-3 border rounded-lg flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{new Date(e.entryDate).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground flex gap-4">
                  {e.mood != null && <span>Настроение: {e.mood}</span>}
                  {e.painScore != null && <span>Боль: {e.painScore}</span>}
                  {e.sleepHours != null && <span>Сон: {e.sleepHours}ч</span>}
                  {e.steps != null && <span>Шаги: {e.steps}</span>}
                  {e.temperature != null && <span>t°: {e.temperature}°C</span>}
                  {e.weight != null && <span>Вес: {e.weight} кг</span>}
                  {(e.systolic != null || e.diastolic != null) && <span>АД: {e.systolic}/{e.diastolic}</span>}
                  {e.pulse != null && <span>Пульс: {e.pulse}</span>}
                </div>
                {(e.symptoms || e.notes) && <div className="w-full text-sm text-gray-700 mt-2">{e.symptoms || e.notes}</div>}
                {e.tags?.length > 0 && (
                  <div className="w-full mt-2 flex gap-2 flex-wrap">
                    {e.tags.map(t => (
                      <span key={t.tag.id} className="px-2 py-0.5 rounded text-xs border" style={{ borderColor: t.tag.color || '#CBD5E1' }}>{t.tag.name}</span>
                    ))}
                  </div>
                )}
                <div className="ml-auto">
                  <Button variant="outline" onClick={() => deleteEntry(e.id)}>Удалить</Button>
                </div>
              </div>
            ))}
            {!loading && entries.length === 0 && (
              <div className="text-center text-muted-foreground">Записей пока нет</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


