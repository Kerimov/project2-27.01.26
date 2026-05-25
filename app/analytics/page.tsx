'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

type TrendPoint = { day: string; mood: number|null; pain: number|null; sleep: number|null; steps: number|null; systolic: number|null; diastolic: number|null; pulse: number|null }

export default function AnalyticsPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<{ kpi: any; trend: TrendPoint[] } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch('/api/analytics/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(res => setData({ kpi: res.kpi, trend: res.trend }))
      .finally(() => setLoading(false))
  }, [token])

  const last7 = useMemo(() => {
    const sorted = (data?.trend || []).slice().sort((a: any, b: any) => a.day.localeCompare(b.day))
    return sorted.slice(-7)
  }, [data])

  if (!user) return null

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Аналитика</h1>
        <Button variant="outline" onClick={() => router.back()}>Назад</Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle>Документы</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{data?.kpi?.documentsCount ?? '—'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Анализы</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{data?.kpi?.analysesCount ?? '—'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Предстоящие приемы</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{data?.kpi?.upcomingAppointments ?? '—'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Средний сон</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{data?.kpi?.avgSleep ?? '—'}ч</CardContent></Card>
      </div>

      {/* Simple charts without external libs (sparkline-style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Настроение (7 дней)" points={last7.map(p => p.mood ?? 0)} suffix="/5" />
        <ChartCard title="Сон (7 дней)" points={last7.map(p => p.sleep ?? 0)} suffix="ч" />
        <ChartCard title="Шаги (7 дней)" points={last7.map(p => p.steps ?? 0)} />
        <ChartCard title="АД (сист./диаст.) 7 дней" dual pointsA={last7.map(p => p.systolic ?? 0)} pointsB={last7.map(p => p.diastolic ?? 0)} />
      </div>
    </div>
  )
}

function ChartCard({ title, points, suffix = '', dual, pointsA, pointsB }: any) {
  const width = 300, height = 80, padding = 6
  const arr: number[] = dual ? pointsA : points
  const max = Math.max(1, ...arr, ...(dual ? pointsB : []))
  const step = (width - padding * 2) / Math.max(1, (arr.length - 1))
  const path = arr.map((v, i) => `${i===0 ? 'M' : 'L'} ${padding + i*step} ${height - padding - (v/max)*(height-padding*2)}`).join(' ')
  const pathB = dual ? pointsB.map((v: number, i: number) => `${i===0 ? 'M' : 'L'} ${padding + i*step} ${height - padding - (v/max)*(height-padding*2)}`).join(' ') : null

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <svg width={width} height={height} className="w-full">
          <path d={path} stroke="#2563eb" fill="none" strokeWidth={2} />
          {pathB && <path d={pathB} stroke="#16a34a" fill="none" strokeWidth={2} />}
        </svg>
        {suffix && <div className="text-xs text-muted-foreground">Единицы: {suffix}</div>}
      </CardContent>
    </Card>
  )
}


