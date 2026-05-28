'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
//
import { Users, Calendar, FileText, Stethoscope, Pill, NotebookPen } from 'lucide-react'

interface PatientCardData {
  patient: { id: string; name: string; email: string; createdAt: string }
  patientRecord: any
  analyses: any[]
  recommendations: any[]
  appointments: any[]
  prescriptions: any[]
  notes: any[]
  documents?: any[]
  carePlanTasks?: any[]
}

export default function PatientCardPage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<PatientCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [trends, setTrends] = useState<Record<string, { date: string; value: number; referenceMin?: number | null; referenceMax?: number | null; isNormal?: boolean | null }[]>>({})
  const [insights, setInsights] = useState<string>('')
  const [analysisCategory, setAnalysisCategory] = useState<string>('Все')
  const [selectedAnalyses, setSelectedAnalyses] = useState<Record<string, boolean>>({})
  const [compareResult, setCompareResult] = useState<{ indicators?: Record<string, { analysisId: string; date: string; value: number; unit?: string|null }[]>; insights?: string } | null>(null)
  const [timelineMode, setTimelineMode] = useState<'all' | 'important'>('all')
  const [problemDraft, setProblemDraft] = useState<string>('')
  const [problemSaving, setProblemSaving] = useState(false)

  const [aiInput, setAiInput] = useState<string>('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<string>('')
  const [aiSources, setAiSources] = useState<Array<{ sourceType?: string; id?: string; label?: string; date?: string | null; url?: string | null }>>([])
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/doctor/patients/${params.id}`, { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          setData(json)
          const notes = Array.isArray(json?.notes) ? json.notes : []
          const latestProblem = notes.find((n: any) => String(n?.noteType || '').toLowerCase() === 'problem_list')
          if (latestProblem?.content) setProblemDraft(String(latestProblem.content))
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.id])

  useEffect(() => {
    const loadTrends = async () => {
      try {
        const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const [tr, ai] = await Promise.all([
          fetch(`/api/doctor/analyses/trends?patientId=${params.id}`, { headers: lsToken ? { Authorization: `Bearer ${lsToken}` } : undefined, credentials: 'include' }).then(r=>r.json()).catch(()=>({})),
          fetch(`/api/doctor/analyses/insights?patientId=${params.id}`, { headers: lsToken ? { Authorization: `Bearer ${lsToken}` } : undefined, credentials: 'include' }).then(r=>r.json()).catch(()=>({}))
        ])
        if (tr?.indicators && typeof tr.indicators === 'object') setTrends(tr.indicators)
        if (typeof ai?.insights === 'string') setInsights(ai.insights)
      } catch {}
    }
    loadTrends()
  }, [params.id])

  const quickPrompts = useMemo(() => {
    return [
      {
        key: 'questions',
        label: 'Вопросы пациенту',
        text: 'Сформулируй 10 уточняющих вопросов пациенту (строго по источникам).'
      },
      {
        key: 'labs',
        label: 'Какие анализы докинуть',
        text: 'Какие анализы/исследования стоит добавить и зачем (строго по данным источников)?'
      },
      {
        key: 'trend',
        label: 'Объяснить динамику',
        text: 'Что может объяснить динамику показателей? Дай гипотезы и что проверить далее (строго по источникам).'
      }
    ]
  }, [])

  function TrendChart({ series }: { series: { date: string; value: number }[] }) {
    if (!series || series.length === 0) return null
    const points = series.map(p => ({ x: new Date(p.date).getTime(), y: p.value }))
    const xs = points.map(p => p.x), ys = points.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const pad = 8, w = 260, h = 120
    const sx = (x:number) => pad + (w - 2*pad) * (maxX === minX ? 0.5 : (x - minX) / (maxX - minX))
    const sy = (y:number) => h - pad - (h - 2*pad) * (maxY === minY ? 0.5 : (y - minY) / (maxY - minY))
    const path = points.map((p,i)=>`${i===0?'M':'L'}${sx(p.x)},${sy(p.y)}`).join(' ')
    return (
      <svg width={260} height={120} className="bg-white rounded border">
        <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} />
        {points.map((p,i)=>(<circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill="#2563eb" />))}
      </svg>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка карточки пациента...</div>
      </div>
    )
  }

  if (!data) return null

  const { patient, patientRecord, analyses, recommendations, appointments, prescriptions, notes, documents = [], carePlanTasks = [] } = data

  const timeline: Array<{ ts: number; kind: string; title: string; meta?: string; ref?: { type: 'document' | 'analysis'; id: string } }> = []
  for (const a of Array.isArray(appointments) ? appointments : []) {
    const ts = new Date(a.scheduledAt).getTime()
    if (!Number.isFinite(ts)) continue
    timeline.push({
      ts,
      kind: 'appointment',
      title: `Приём (${a.appointmentType || '—'})`,
      meta: `${new Date(a.scheduledAt).toLocaleString('ru-RU')} • ${a.status}`
    })
  }
  for (const an of Array.isArray(analyses) ? analyses : []) {
    const ts = new Date(an.date).getTime()
    if (!Number.isFinite(ts)) continue
    timeline.push({
      ts,
      kind: 'analysis',
      title: `Анализ: ${an.title || an.type || '—'}`,
      meta: `${new Date(an.date).toLocaleDateString('ru-RU')} • ${an.status}`,
      ref: { type: 'analysis', id: an.id }
    })
  }
  for (const d of Array.isArray(documents) ? documents : []) {
    const ts = new Date(d.uploadDate).getTime()
    if (!Number.isFinite(ts)) continue
    timeline.push({
      ts,
      kind: 'document',
      title: `Документ: ${d.fileName || '—'}`,
      meta: `${new Date(d.uploadDate).toLocaleDateString('ru-RU')} • ${d.studyType || d.category || ''}`.trim(),
      ref: { type: 'document', id: d.id }
    })
  }
  for (const t of Array.isArray(carePlanTasks) ? carePlanTasks : []) {
    const ts = new Date(t.createdAt || t.updatedAt || Date.now()).getTime()
    if (!Number.isFinite(ts)) continue
    const due = t.snoozedUntil || t.dueAt
    const dueStr = due ? ` • срок: ${new Date(due).toLocaleDateString('ru-RU')}` : ''
    timeline.push({
      ts,
      kind: 'careplan',
      title: `Задача плана: ${t.title}`,
      meta: `${t.status}${dueStr}`
    })
  }
  timeline.sort((a, b) => b.ts - a.ts)
  const timelineShown =
    timelineMode === 'important'
      ? timeline.filter((x) => x.kind !== 'document').slice(0, 25)
      : timeline.slice(0, 35)

  async function askDoctorAI(message: string, mode: string) {
    try {
      setAiBusy(true)
      setAiError(null)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers = lsToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${lsToken}` } : { 'Content-Type': 'application/json' }
      const res = await fetch('/api/doctor/ai/second-opinion', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ patientId: patient.id, message, mode })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'Ошибка')
      setAiAnswer(String(j?.response || ''))
      setAiSources(Array.isArray(j?.sources) ? j.sources : [])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Ошибка')
      setAiAnswer('')
      setAiSources([])
    } finally {
      setAiBusy(false)
    }
  }

  async function saveProblemList() {
    try {
      setProblemSaving(true)
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch(`/api/doctor/patients/${patient.id}/problem-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(lsToken ? { Authorization: `Bearer ${lsToken}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ content: problemDraft })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || 'Ошибка сохранения')
      const re = await fetch(`/api/doctor/patients/${patient.id}`, { credentials: 'include' })
      if (re.ok) setData(await re.json())
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setProblemSaving(false)
    }
  }

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient-brand">
            {patient.name}
          </h1>
          <p className="text-muted-foreground">{patient.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-effect border-0 shadow-medical lg:col-span-2">
            <CardHeader>
              <CardTitle>История анализов</CardTitle>
              <CardDescription>Последние результаты</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="text-sm text-muted-foreground">Категория</div>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={analysisCategory}
                  onChange={e => setAnalysisCategory(e.target.value)}
                >
                  {['Все', ...Array.from(new Set(analyses.map((a:any)=>a.type || 'прочее')))].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="flex-1" />
                <Button size="sm" onClick={() => { setAdding(true) }}>Добавить анализ</Button>
              </div>
              {analyses.length === 0 ? (
                <div className="text-muted-foreground">Анализы не найдены</div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(
                    analyses
                      .filter((a:any)=> analysisCategory==='Все' ? true : (a.type || 'прочее')===analysisCategory)
                      .reduce((acc: Record<string, any[]>, a: any) => {
                        const key = new Date(a.date).toLocaleDateString('ru-RU')
                        if (!acc[key]) acc[key] = []
                        acc[key].push(a)
                        return acc
                      }, {})
                  ).sort((a,b)=>{
                    // sort dates desc
                    const da = a[0].split('.').reverse().join('-')
                    const db = b[0].split('.').reverse().join('-')
                    return db.localeCompare(da)
                  }).map(([dateLabel, items]) => (
                    <div key={dateLabel}>
                      <div className="text-xs font-medium text-muted-foreground mb-2">{dateLabel}</div>
                      <div className="space-y-3">
                        {(items as any[]).map((a:any)=> (
                          <div key={a.id} className="p-3 rounded-lg bg-white/70 border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-medium">{a.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {(a.type || 'Категория')} · {a.document?.laboratory || 'Лаборатория —'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground flex items-center gap-1">
                                <input type="checkbox" checked={!!selectedAnalyses[a.id]} onChange={(e)=> setSelectedAnalyses(s=>({ ...s, [a.id]: e.target.checked }))} />
                                Сравнить
                              </label>
                            {a.documentId && (
                              <Button size="sm" variant="outline" onClick={() => router.push(`/documents/${a.documentId}`)}>Открыть</Button>
                            )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle>Карточка пациента</CardTitle>
              <CardDescription>Сводная информация</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Тип записи</span><Badge>{patientRecord?.recordType || '—'}</Badge></div>
                {patientRecord?.diagnosis && (<div className="flex items-center justify-between"><span>Диагноз</span><span className="font-medium">{patientRecord.diagnosis}</span></div>)}
                {patientRecord?.nextVisit && (<div className="flex items-center justify-between"><span>Следующий визит</span><span>{new Date(patientRecord.nextVisit).toLocaleString('ru-RU')}</span></div>)}
                <div className="flex items-center justify-between"><span>Статус</span><Badge variant="secondary">
                  {patientRecord?.status === 'active' ? 'Активен' : 
                   patientRecord?.status === 'completed' ? 'Завершен' : 
                   patientRecord?.status === 'cancelled' ? 'Отменен' : 
                   patientRecord?.status || '—'}
                </Badge></div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical lg:col-span-2">
            <CardHeader>
              <CardTitle>Таймлайн</CardTitle>
              <CardDescription>Приёмы + анализы + документы + задачи плана</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">Режим</div>
                  <select className="border rounded px-2 py-1 text-sm" value={timelineMode} onChange={(e) => setTimelineMode(e.target.value as any)}>
                    <option value="all">Все</option>
                    <option value="important">Важное</option>
                  </select>
                </div>
                <Link href={`/doctor/patients/${patient.id}/edit`} className="text-sm text-primary hover:underline">Редактировать карточку</Link>
              </div>

              {timelineShown.length === 0 ? (
                <div className="text-sm text-muted-foreground">Нет событий</div>
              ) : (
                <div className="space-y-2">
                  {timelineShown.map((e, idx) => (
                    <div key={`${e.kind}-${e.ts}-${idx}`} className="p-3 rounded-lg bg-white/70 border flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          {e.ref?.type === 'document' ? (
                            <Link href={`/doctor/documents/${e.ref.id}`} className="text-primary hover:underline">
                              {e.title}
                            </Link>
                          ) : e.ref?.type === 'analysis' ? (
                            <span>{e.title}</span>
                          ) : (
                            <span>{e.title}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{e.meta}</div>
                      </div>
                      <Badge variant="outline">{e.kind}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle>Problem list (врач)</CardTitle>
              <CardDescription>Коротко: проблемы/гипотезы/что уточнить. Сохраняется с историей.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-[180px] border rounded p-2 text-sm"
                value={problemDraft}
                onChange={(e) => setProblemDraft(e.target.value)}
                placeholder="- Проблема 1 (severity)\n  - данные: ...\n  - вопросы: ..."
              />
              <div className="flex justify-end mt-3">
                <Button onClick={saveProblemList} disabled={problemSaving}>
                  {problemSaving ? 'Сохраняю...' : 'Сохранить'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Card className="glass-effect border-0 shadow-medical lg:col-span-2">
            <CardHeader>
              <CardTitle>Динамика показателей</CardTitle>
              <CardDescription>Графики по ключевым индикаторам</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Кнопка сравнения выбранных анализов */}
              <div className="mb-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={async()=>{
                  const ids = Object.entries(selectedAnalyses).filter(([,v])=>v).map(([k])=>k)
                  if (ids.length < 2) { alert('Выберите минимум два анализа для сравнения'); return }
                  try {
                    const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                    const res = await fetch('/api/doctor/analyses/compare', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(lsToken ? { Authorization: `Bearer ${lsToken}` } : {}) },
                      credentials: 'include',
                      body: JSON.stringify({ analysisIds: ids, patientId: patient.id })
                    })
                    const data = await res.json().catch(()=>({}))
                    if (!res.ok) { alert(data?.error || 'Ошибка сравнения'); return }
                    setCompareResult(data)
                  } catch (e) { console.error(e); alert('Ошибка сравнения') }
                }}>Сравнить выбранные</Button>
                <Button size="sm" onClick={()=>{
                  const ids = Object.entries(selectedAnalyses).filter(([,v])=>v).map(([k])=>k)
                  if (ids.length < 2) { alert('Выберите минимум два анализа'); return }
                  router.push(`/doctor/patients/${patient.id}/compare?ids=${encodeURIComponent(ids.join(','))}`)
                }}>Открыть графики</Button>
              </div>

              {compareResult?.indicators && (
                <div className="mb-6">
                  <div className="text-sm font-medium mb-2">Сравнение выбранных анализов</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(compareResult.indicators).slice(0,6).map(([name, series]) => (
                      <div key={name} className="p-3 rounded-lg bg-white/70 border">
                        <div className="text-sm font-medium mb-2 line-clamp-1">{name}</div>
                        <TrendChart series={(series as any).map((p:any)=>({ date: p.date, value: p.value }))} />
                      </div>
                    ))}
                  </div>
                  {compareResult?.insights && (
                    <div className="mt-3 p-3 rounded bg-yellow-50 border text-sm text-yellow-800 whitespace-pre-wrap">{compareResult.insights}</div>
                  )}
                </div>
              )}

              {Object.keys(trends).length === 0 ? (
                <div className="text-muted-foreground">Недостаточно данных для построения графиков</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.entries(trends).slice(0, 6).map(([name, series]) => (
                    <div key={name} className="p-3 rounded-lg bg-white/70 border">
                      <div className="text-sm font-medium mb-2 line-clamp-1">{name}</div>
                      <TrendChart series={series as any} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle>Второе мнение (AI для врача)</CardTitle>
              <CardDescription>
                Строго по данным пациента. В ответе всегда есть источники (анализы/документы/анкета).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((p) => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant="outline"
                    disabled={aiBusy}
                    onClick={() => {
                      setAiInput(p.text)
                      askDoctorAI(p.text, p.key)
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Спросите: вопросы/что досдать/почему динамика…" />
                <Button disabled={aiBusy || !aiInput.trim()} onClick={() => askDoctorAI(aiInput.trim(), 'free')}>
                  {aiBusy ? 'Думаю…' : 'Спросить'}
                </Button>
              </div>

              {aiError ? <div className="text-sm text-destructive">{aiError}</div> : null}

              {aiAnswer ? (
                <pre className="whitespace-pre-wrap text-sm bg-white/70 border rounded p-3 max-h-[45vh] overflow-auto">{aiAnswer}</pre>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Нажмите кнопку сверху или задайте вопрос. Если данных мало — попросите пациента загрузить документ/анализ или заполнить pre‑visit.
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium">Источники</div>
                {aiSources.length === 0 ? (
                  <div className="text-xs text-muted-foreground">—</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {aiSources.map((s) =>
                      s?.url ? (
                        <Link key={`${s.sourceType}:${s.id}`} href={String(s.url)}>
                          <Badge variant="secondary" className="cursor-pointer hover:underline">{s.label || `${s.sourceType}:${s.id}`}</Badge>
                        </Link>
                      ) : (
                        <Badge key={`${s.sourceType}:${s.id}`} variant="secondary">{s.label || `${s.sourceType}:${s.id}`}</Badge>
                      )
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle>AI-анализ динамики</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm text-gray-700">
                {insights || 'Аналитика в процессе или данных пока недостаточно.'}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical lg:col-span-2">
            <CardHeader>
              <CardTitle>Рекомендации</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <div className="text-muted-foreground">Нет рекомендаций</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {recommendations.slice(0, 6).map((r) => (
                    <div key={r.id} className="p-3 rounded-lg bg-white/70 border">
                      <div className="font-medium mb-1">{r.title}</div>
                      <div className="text-sm text-muted-foreground mb-2">{r.description}</div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">приоритет {r.priority}</Badge>
                        <Badge variant="secondary">{r.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle>Визиты и назначения</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium mb-2">Ближайшие визиты</div>
                  {appointments.slice(0, 3).map((v) => (
                    <div key={v.id} className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4" /> {new Date(v.scheduledAt).toLocaleString('ru-RU')} · {
                        v.status === 'scheduled' ? 'Запланировано' : 
                        v.status === 'confirmed' ? 'Подтверждено' : 
                        v.status === 'completed' ? 'Завершено' : 
                        v.status === 'cancelled' ? 'Отменено' : 
                        v.status === 'rescheduled' ? 'Перенесено' : 
                        v.status
                      }
                    </div>
                  ))}
                  {appointments.length === 0 && <div className="text-sm text-muted-foreground">Нет визитов</div>}
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Рецепты</div>
                  {prescriptions.slice(0, 3).map((p) => (
                    <div key={p.id} className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <Pill className="w-4 h-4" /> {p.medication}, {p.dosage} · {p.frequency}
                    </div>
                  ))}
                  {prescriptions.length === 0 && <div className="text-sm text-muted-foreground">Нет активных рецептов</div>}
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Заметки</div>
                  {notes.slice(0, 3).map((n) => (
                    <div key={n.id} className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <NotebookPen className="w-4 h-4" /> {n.title}
                    </div>
                  ))}
                  {notes.length === 0 && <div className="text-sm text-muted-foreground">Нет заметок</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl glass-effect border-0 shadow-medical-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Новый анализ</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setAdding(false)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  id="doctor-upload-file"
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : '')}
                />
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Выбрать файл</Button>
                  <span className="text-sm text-muted-foreground">{selectedFileName || 'Файл не выбран'}</span>
                </div>
                <p className="text-xs text-muted-foreground">Допустимые форматы: PDF, JPG, PNG. До 10 МБ.</p>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setAdding(false)}>Отмена</Button>
                <Button onClick={async () => {
                  try {
                  const fi = fileInputRef.current
                  if (!fi || !fi.files || !fi.files[0]) {
                    alert('Выберите файл')
                    return
                  }
                  const fd = new FormData()
                  fd.append('file', fi.files[0])
                  fd.append('patientId', patient.id)
                  const up = await fetch('/api/documents/upload', { method: 'POST', body: fd, credentials: 'include' })
                  if (!up.ok) throw new Error('upload failed')
                  const upJson = await up.json()
                  const documentId = upJson?.document?.id
                  setAdding(false)
                  // Ждем распознавание: опрос /api/documents/[id] до parsed=true
                  if (documentId) {
                    for (let i = 0; i < 30; i++) { // до ~60 сек при шаге 2с
                      await new Promise(r => setTimeout(r, 2000))
                      const dres = await fetch(`/api/documents/${documentId}`, { credentials: 'include' })
                      if (dres.ok) {
                        const dj = await dres.json()
                        if (dj?.document?.parsed) break
                      }
                    }
                  }
                  const re = await fetch(`/api/doctor/patients/${patient.id}`, { credentials: 'include' })
                  if (re.ok) setData(await re.json())
                  } catch {}
                }}>Сохранить</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}


