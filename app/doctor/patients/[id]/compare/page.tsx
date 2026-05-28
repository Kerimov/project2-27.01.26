'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type SeriesMap = Record<string, { analysisId: string; date: string; value: number; unit?: string | null }[]>

export default function PatientComparePage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const sp = useSearchParams()
  const ids = useMemo(() => (sp.get('ids') || '').split(',').filter(Boolean), [sp])
  const [data, setData] = useState<{ indicators: SeriesMap; insights?: string; analyses?: { id: string; date: string; title: string }[] } | null>(null)

  useEffect(() => {
    const load = async () => {
      if (ids.length < 2) return
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/doctor/analyses/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(lsToken ? { Authorization: `Bearer ${lsToken}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ patientId: params.id, analysisIds: ids })
      })
      const json = await res.json().catch(()=>({}))
      if (res.ok) setData(json)
      else alert(json?.error || 'Ошибка загрузки сравнения')
    }
    load()
  }, [params.id, ids])

  const indicators = useMemo(() => data?.indicators || {}, [data])
  const palette = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

  function OverlayChart({ seriesByAnalysis }: { seriesByAnalysis: { analysisId: string; date: string; value: number; unit?: string|null }[] }) {
    if (!seriesByAnalysis?.length) return null
    const sorted = [...seriesByAnalysis].sort((a,b)=>a.date.localeCompare(b.date))
    const points = sorted.map(p => ({ x: new Date(p.date).getTime(), y: p.value, id: p.analysisId }))
    const xs = points.map(p => p.x), ys = points.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    
    // Адаптивные размеры
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const pad = isMobile ? 20 : 28
    const w = isMobile ? Math.min(400, window.innerWidth - 40) : 560
    const h = isMobile ? 180 : 220
    
    const sx = (x:number) => pad + (w - 2*pad) * (maxX === minX ? 0.5 : (x - minX) / (maxX - minX))
    const sy = (y:number) => h - pad - (h - 2*pad) * (maxY === minY ? 0.5 : (y - minY) / (maxY - minY))

    // split by analysis id to draw multiple lines
    const byId: Record<string, { x:number; y:number }[]> = {}
    for (const p of points) {
      if (!byId[p.id]) byId[p.id] = []
      byId[p.id].push({ x: sx(p.x), y: sy(p.y) })
    }
    Object.values(byId).forEach(a=>a.sort((a,b)=>a.x-b.x))

    return (
      <div className="w-full overflow-x-auto">
        <svg 
          width={w} 
          height={h} 
          className="bg-white rounded border mx-auto"
          viewBox={`0 0 ${w} ${h}`}
        >
          {/* сетка */}
          {Array.from({length: 4}).map((_,i)=>(
            <line 
              key={i} 
              x1={pad} 
              y1={pad + i*(h-2*pad)/3} 
              x2={w-pad} 
              y2={pad + i*(h-2*pad)/3} 
              stroke="#f3f4f6" 
              strokeWidth="1" 
            />
          ))}
          {/* axes */}
          <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#374151" strokeWidth="2" />
          <line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke="#374151" strokeWidth="2" />
          
          {/* подписи осей */}
          <text x={pad - 5} y={pad + 5} fontSize={isMobile ? "10" : "12"} fill="#6b7280" textAnchor="end">
            {maxY.toFixed(1)}
          </text>
          <text x={pad - 5} y={h - pad + 5} fontSize={isMobile ? "10" : "12"} fill="#6b7280" textAnchor="end">
            {minY.toFixed(1)}
          </text>
          
          {Object.entries(byId).map(([id, pts], idx) => {
            const path = pts.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')
            const color = palette[idx % palette.length]
            const seriesSorted = sorted.filter(q=>q.analysisId===id)
            const firstVal = seriesSorted[0]?.value
            const lastVal = seriesSorted[seriesSorted.length-1]?.value
            return (
              <g key={id}>
                <path d={path} fill="none" stroke={color} strokeWidth={isMobile ? 2 : 3} />
                {pts.map((p,i)=> (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={isMobile ? 3 : 4} fill={color} />
                    {/* значение над точкой */}
                    <text x={p.x + (isMobile ? 4 : 6)} y={p.y - (isMobile ? 4 : 6)} fontSize={isMobile ? "9" : "10"} fill={color} className="font-medium">
                      {sorted.filter(q=>q.analysisId===id)[i]?.value}
                    </text>
                  </g>
                ))}
                {/* подпись было→стало возле последней точки */}
                {pts.length>0 && (
                  <text x={pts[pts.length-1].x + (isMobile ? 6 : 8)} y={pts[pts.length-1].y + (isMobile ? 10 : 12)} fontSize={isMobile ? "10" : "11"} fill={color} className="font-medium">
                    {typeof firstVal==='number' && typeof lastVal==='number' ? `${firstVal} → ${lastVal}` : ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  const indicatorList = useMemo(() => Object.keys(indicators), [indicators])
  const indicatorSeverity = useMemo(() => {
    const res: Record<string, 'high'|'medium'|'low'> = {}
    for (const [name, series] of Object.entries(indicators)) {
      const vals = (series || []).map(s => s.value).filter(v => typeof v === 'number')
      if (vals.length < 2) { res[name] = 'low'; continue }
      const max = Math.max(...vals), min = Math.min(...vals)
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length || 1
      const spread = (max - min) / Math.max(avg, 1e-6)
      res[name] = spread > 0.2 ? 'high' : spread > 0.1 ? 'medium' : 'low'
    }
    return res
  }, [indicators])
  const [active, setActive] = useState<string>('')
  useEffect(() => {
    if (!active && indicatorList.length) setActive(indicatorList[0])
  }, [active, indicatorList])

  return (
    <div className="web-page">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Сравнение анализов</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Пациент: {params.id}</p>
          </div>
          <Button variant="outline" onClick={()=>router.back()} className="text-sm">Назад</Button>
        </div>

        <Card className="glass-effect border-0 shadow-medical">
          <CardHeader>
            <CardTitle>Показатели</CardTitle>
            <CardDescription>Выберите показатель, чтобы отобразить наложенный график</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {indicatorList.map(name => {
                const sev = indicatorSeverity[name]
                const color = sev==='high' ? 'bg-red-50 text-red-700 border-red-300'
                  : sev==='medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                  : 'bg-white'
                return (
                  <Button 
                    key={name}
                    size="sm"
                    variant={active===name?'default':'outline'}
                    className={`${active===name?'' : color} text-xs sm:text-sm`}
                    onClick={()=>setActive(name)}
                  >
                    {name}
                  </Button>
                )
              })}
            </div>
            {active && indicators[active] && (
              <>
                <OverlayChart seriesByAnalysis={indicators[active]} />
                {/* Легенда по анализам */}
                <div className="mt-2 flex flex-wrap gap-3 text-xs sm:text-sm">
                  {Array.from(new Set((indicators[active]||[]).map(s=>s.analysisId))).map((id, idx)=>{
                    const color = palette[idx % palette.length]
                    const title = data?.analyses?.find(a=>a.id===id)?.title || id
                    const date = data?.analyses?.find(a=>a.id===id)?.date
                    const ds = date ? new Date(date as any).toLocaleDateString('ru-RU') : ''
                    const sForId = (indicators[active]||[]).filter(v=>v.analysisId===id)
                    const firstVal = sForId[0]?.value
                    const lastVal = sForId[sForId.length-1]?.value
                    return (
                      <span key={id} className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-gray-700 break-words">{title}{ds?` • ${ds}`:''}{(typeof firstVal==='number'&&typeof lastVal==='number')?` • ${firstVal} → ${lastVal}`:''}</span>
                      </span>
                    )
                  })}
                </div>
                {/* Пояснения под графиком */}
                <div className="mt-4 text-xs sm:text-sm">
                  <div className="font-medium mb-1">Пояснения</div>
                  <ul className="list-disc ml-4 sm:ml-5 space-y-1">
                    {(() => {
                      const s = indicators[active]
                      const vals = s.map(v=>v.value)
                      const max = Math.max(...vals)
                      const min = Math.min(...vals)
                      const avg = vals.reduce((a,b)=>a+b,0)/Math.max(vals.length,1)
                      const spread = ((max-min)/Math.max(Math.abs(avg),1e-6))*100
                      const trend = s.length>=2 ? (s[s.length-1].value - s[0].value) : 0
                      return [
                        <li key="range" className="break-words">Диапазон значений: {min} — {max} ({spread.toFixed(1)}%)</li>,
                        <li key="trend" className="break-words">Изменение от первого к последнему: {trend>0?`+${trend.toFixed(2)}`:trend<0?`${trend.toFixed(2)}`:'0'}</li>,
                        <li key="count">Количество точек: {s.length}</li>
                      ]
                    })()}
                  </ul>
                </div>
              </>
            )}
            {data?.insights && (
              <div className="mt-4 p-3 rounded bg-blue-50 border text-xs sm:text-sm text-blue-800 whitespace-pre-wrap break-words">{data.insights}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


