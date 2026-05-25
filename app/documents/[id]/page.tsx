'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Activity,
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  User,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  AlertCircle,
  Trash2
} from 'lucide-react'
import Link from 'next/link'

interface Document {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  fileUrl: string
  uploadDate: string
  parsed: boolean
  category?: string
  studyType?: string
  studyDate?: string
  laboratory?: string
  doctor?: string
  findings?: string
  ocrConfidence?: number
  rawText?: string
  indicators?: Array<{
    name: string
    value: string | number
    unit?: string
    referenceMin?: number
    referenceMax?: number
    isNormal?: boolean
  }>
}

export default function DocumentViewPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const params = useParams()
  const [document, setDocument] = useState<Document | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showFixMode, setShowFixMode] = useState(false)
  const [fixSaving, setFixSaving] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const [fixEdits, setFixEdits] = useState<{
    studyType?: string
    studyDate?: string
    laboratory?: string
    doctor?: string
    findings?: string
    indicators?: Array<{
      name: string
      value?: string
      unit?: string
      referenceMin?: string
      referenceMax?: string
      isNormal?: boolean | null
    }>
  }>({})

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (user && params.id) {
      loadDocument()
    }
  }, [user, authLoading, params.id])

  const loadDocument = async () => {
    try {
      const response = await fetch(`/api/documents/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setDocument(data.document)
      } else {
        router.push('/documents')
      }
    } catch (error) {
      console.error('Error loading document:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!document) return null

  const isDoctorReport =
    document.fileType.includes('markdown') ||
    document.studyType?.toLowerCase().includes('отчёт') ||
    document.category === 'medical_report'

  // --- режим исправления (MVP) ---
  const parseNum = (v: any) => {
    if (v === null || v === undefined) return null
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v.replace(',', '.').replace(/[^\d.-]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    return null
  }

  const issues: Array<{ key: string; title: string; hint: string }> = []
  if (!document.studyType) issues.push({ key: 'studyType', title: 'Тип исследования не распознан', hint: 'Например: "Клинический анализ крови"' })
  if (!document.studyDate) issues.push({ key: 'studyDate', title: 'Дата исследования не распознана', hint: 'Выберите дату исследования' })
  if (!document.laboratory) issues.push({ key: 'laboratory', title: 'Лаборатория не распознана', hint: 'Например: "Инвитро"' })

  const indicatorIssues: any[] = []
  if (Array.isArray(document.indicators)) {
    for (const i of document.indicators) {
      const name = (i?.name || '').toString()
      if (!name) continue
      const valueNum = parseNum(i?.value)
      const unit = (i?.unit || '').toString().trim()
      const refMin = i?.referenceMin
      const refMax = i?.referenceMax
      const badValue = valueNum === null
      const missingUnit = !unit
      const missingRef = refMin === undefined || refMax === undefined || refMin === null || refMax === null
      if (badValue || missingUnit || missingRef) {
        indicatorIssues.push({
          name,
          badValue,
          missingUnit,
          missingRef
        })
      }
    }
  }

  const topIndicatorIssues = indicatorIssues.slice(0, 5)

  return (
    <div className="web-page">
      <main className="web-container">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Health Summary */}
          {document.indicators && document.indicators.length > 0 && (
            <Card className={`border-2 ${
              document.indicators.some(i => !i.isNormal)
                ? 'border-destructive/50 bg-destructive/5'
                : 'border-green-500/50 bg-green-50'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {document.indicators.some(i => !i.isNormal) ? (
                    <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0 mt-1" />
                  ) : (
                    <CheckCircle className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">
                      {document.indicators.some(i => !i.isNormal) 
                        ? '⚠️ Обнаружены отклонения от нормы'
                        : '✅ Все показатели в норме'
                      }
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {document.indicators.filter(i => i.isNormal).length}
                        </p>
                        <p className="text-xs text-muted-foreground">В норме</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-destructive">
                          {document.indicators.filter(i => !i.isNormal).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Отклонения</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {document.indicators.length}
                        </p>
                        <p className="text-xs text-muted-foreground">Всего показателей</p>
                      </div>
                    </div>
                    {document.indicators.some(i => !i.isNormal) && (
                      <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                        <p className="text-sm font-medium text-destructive mb-1">
                          🏥 Рекомендуется консультация врача
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Обнаруженные отклонения требуют внимания специалиста для интерпретации и назначения лечения при необходимости.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle className="text-2xl">{document.fileName}</CardTitle>
                    <CardDescription>
                      Загружено: {new Date(document.uploadDate).toLocaleString('ru-RU')}
                    </CardDescription>
                  </div>
                </div>
                {document.parsed && (
                  <Badge variant="default" className="ml-2">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Распознано
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {document.ocrConfidence && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Уверенность распознавания</span>
                    <span className="font-medium">{Math.round(document.ocrConfidence * 100)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${document.ocrConfidence * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4">
                {document.studyType && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Тип исследования</p>
                      <p className="font-medium">{document.studyType}</p>
                    </div>
                  </div>
                )}
                
                {document.studyDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Дата исследования</p>
                      <p className="font-medium">
                        {new Date(document.studyDate).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                )}
                
                {document.laboratory && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Лаборатория</p>
                      <p className="font-medium">{document.laboratory}</p>
                    </div>
                  </div>
                )}
                
                {document.doctor && (
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Врач</p>
                      <p className="font-medium">{document.doctor}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Режим исправления (MVP) */}
          {!isDoctorReport && (issues.length > 0 || topIndicatorIssues.length > 0) && (
            <Card className="border-2 border-orange-200 bg-orange-50/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Режим исправления</CardTitle>
                    <CardDescription>
                      Мы нашли несколько полей, которые стоит подтвердить, чтобы анализы/динамика/ИИ работали точнее.
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setShowFixMode(v => !v)}>
                    {showFixMode ? 'Скрыть' : 'Исправить'}
                  </Button>
                </div>
              </CardHeader>
              {showFixMode && (
                <CardContent className="space-y-4">
                  {fixError && (
                    <div className="text-sm text-destructive">{fixError}</div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Тип исследования</div>
                      <Input
                        value={fixEdits.studyType !== undefined ? fixEdits.studyType : (document.studyType || '')}
                        onChange={(e) => setFixEdits((p) => ({ ...p, studyType: e.target.value }))}
                        placeholder="Напр. Клинический анализ крови"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Дата исследования</div>
                      <Input
                        type="date"
                        value={fixEdits.studyDate !== undefined ? fixEdits.studyDate : (document.studyDate ? new Date(document.studyDate).toISOString().slice(0, 10) : '')}
                        onChange={(e) => setFixEdits((p) => ({ ...p, studyDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Лаборатория</div>
                      <Input
                        value={fixEdits.laboratory !== undefined ? fixEdits.laboratory : (document.laboratory || '')}
                        onChange={(e) => setFixEdits((p) => ({ ...p, laboratory: e.target.value }))}
                        placeholder="Напр. Инвитро"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Врач (если есть)</div>
                      <Input
                        value={fixEdits.doctor !== undefined ? fixEdits.doctor : (document.doctor || '')}
                        onChange={(e) => setFixEdits((p) => ({ ...p, doctor: e.target.value }))}
                        placeholder="ФИО врача"
                      />
                    </div>
                  </div>

                  {topIndicatorIssues.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Спорные показатели (до 5)</div>
                      <div className="space-y-2">
                        {topIndicatorIssues.map((x: any) => {
                          const current = (document.indicators || []).find((i) => i.name === x.name)
                          const idx = (fixEdits.indicators || []).findIndex((i) => i.name === x.name)
                          const existing = idx >= 0 ? (fixEdits.indicators || [])[idx] : null
                          const setRow = (patch: any) => {
                            setFixEdits((prev) => {
                              const list = Array.isArray(prev.indicators) ? prev.indicators.slice() : []
                              const pos = list.findIndex((i) => i.name === x.name)
                              const base = pos >= 0 ? list[pos] : { name: x.name }
                              const next = { ...base, ...patch }
                              if (pos >= 0) list[pos] = next
                              else list.push(next)
                              return { ...prev, indicators: list }
                            })
                          }
                          return (
                            <div key={x.name} className="p-3 border rounded-md bg-white/60">
                              <div className="text-sm font-medium">{x.name}</div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Значение</div>
                                  <Input
                                    value={existing?.value ?? String(current?.value ?? '')}
                                    onChange={(e) => setRow({ value: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Ед.</div>
                                  <Input
                                    value={existing?.unit ?? String(current?.unit ?? '')}
                                    onChange={(e) => setRow({ unit: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Норма min</div>
                                  <Input
                                    value={existing?.referenceMin ?? (current?.referenceMin ?? '')?.toString()}
                                    onChange={(e) => setRow({ referenceMin: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Норма max</div>
                                  <Input
                                    value={existing?.referenceMax ?? (current?.referenceMax ?? '')?.toString()}
                                    onChange={(e) => setRow({ referenceMax: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      disabled={fixSaving}
                      onClick={async () => {
                        try {
                          setFixSaving(true)
                          setFixError(null)
                          const indicatorPatch = (fixEdits.indicators || []).map((i) => ({
                            name: i.name,
                            value: i.value ?? undefined,
                            unit: i.unit ?? undefined,
                            referenceMin: i.referenceMin ? Number(i.referenceMin.replace(',', '.')) : null,
                            referenceMax: i.referenceMax ? Number(i.referenceMax.replace(',', '.')) : null,
                            isNormal: i.isNormal ?? undefined
                          }))
                          const res = await fetch(`/api/documents/${document.id}/review`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              patch: {
                                studyType: fixEdits.studyType,
                                studyDate: fixEdits.studyDate,
                                laboratory: fixEdits.laboratory,
                                doctor: fixEdits.doctor,
                                indicators: indicatorPatch
                              }
                            })
                          })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data?.error || 'Ошибка сохранения')
                          setDocument(data.document)
                          setShowFixMode(false)
                        } catch (e) {
                          setFixError(e instanceof Error ? e.message : 'Ошибка')
                        } finally {
                          setFixSaving(false)
                        }
                      }}
                    >
                      {fixSaving ? 'Сохранение...' : 'Сохранить исправления'}
                    </Button>
                    <Button variant="outline" onClick={() => { setFixEdits({}); setFixError(null) }}>
                      Сбросить
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Indicators */}
          {document.indicators && document.indicators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Показатели</CardTitle>
                <CardDescription>Извлеченные значения анализов</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {document.indicators.map((indicator, index) => {
                    const value = typeof indicator.value === 'number' ? indicator.value : parseFloat(indicator.value)
                    const min = indicator.referenceMin || 0
                    const max = indicator.referenceMax || 100
                    
                    // Определяем степень отклонения
                    let deviationPercent = 0
                    let deviationText = ''
                    
                    if (!indicator.isNormal) {
                      if (value < min) {
                        deviationPercent = ((min - value) / (max - min)) * 100
                        deviationText = `↓ ${deviationPercent.toFixed(1)}%`
                      } else {
                        deviationPercent = ((value - max) / (max - min)) * 100
                        deviationText = `↑ ${deviationPercent.toFixed(1)}%`
                      }
                    }
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                          indicator.isNormal 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {indicator.isNormal ? (
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-medium">{indicator.name}</p>
                            {indicator.referenceMin !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                Норма: {indicator.referenceMin}-{indicator.referenceMax} {indicator.unit}
                              </p>
                            )}
                            {!indicator.isNormal && deviationText && (
                              <p className="text-xs font-semibold text-destructive mt-1">
                                Отклонение: {deviationText}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${!indicator.isNormal ? 'text-destructive' : ''}`}>
                            {indicator.value} {indicator.unit}
                          </p>
                          <Badge variant={indicator.isNormal ? "default" : "destructive"} className="text-xs">
                            {indicator.isNormal ? 'Норма' : 'Отклонение'}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Findings */}
          {document.findings && (
            <Card>
              <CardHeader>
                <CardTitle>{isDoctorReport ? 'Отчёт' : 'Заключение'}</CardTitle>
              </CardHeader>
              <CardContent>
                {isDoctorReport ? (
                  <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg max-h-[70vh] overflow-y-auto">
                    {document.findings}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">{document.findings}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Parsed Data Table */}
          {document.rawText && !isDoctorReport && (
            <Card>
              <CardHeader>
                <CardTitle>Данные документа</CardTitle>
                <CardDescription>Структурированные данные из анализа</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Парсим текст для создания таблицы
                  const lines = document.rawText.split('\n')
                  const tableData: Array<{param: string, value: string, ref?: string}> = []
                  
                  // Ищем секции с результатами
                  let inResultSection = false
                  let currentParams: string[] = []
                  let paramIndex = 0
                  
                  lines.forEach((line, idx) => {
                    const trimmed = line.trim()
                    
                    // Определяем начало секции с показателями
                    if (trimmed.match(/Эритроцитарные|Тромбоцитарные|Лейкоцитарные/i)) {
                      currentParams = []
                      paramIndex = 0
                      inResultSection = false
                    }
                    
                    // Находим "Результат"
                    if (trimmed === 'Результат') {
                      inResultSection = true
                      return
                    }
                    
                    // Собираем названия показателей
                    if (!inResultSection && trimmed && 
                        !trimmed.match(/ЛАБОРАТОРИЯ|ДНКОМ|Научный|Ф\.И\.О\.|Дата|Регистрация|Биоматериал|Показатель|ОБЩИЙ АНАЛИЗ|параметры|Единицы|Референсные|Москва|Заявка|Заказчик|Исполнитель|\+7|ицензия|ИНН|ОГРН/i)) {
                      // Это название показателя
                      const match = trimmed.match(/^(.+?)\s*\(([A-Z\-]+)\)/)
                      if (match) {
                        currentParams.push(match[1] + ' (' + match[2] + ')')
                      } else if (trimmed.length > 3 && trimmed.length < 100) {
                        currentParams.push(trimmed)
                      }
                    }
                    
                    // Собираем значения
                    if (inResultSection && trimmed.match(/^\d+[,.]?\d*$/)) {
                      if (paramIndex < currentParams.length) {
                        tableData.push({
                          param: currentParams[paramIndex],
                          value: trimmed
                        })
                        paramIndex++
                      }
                    }
                  })
                  
                  return tableData.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50%]">Показатель</TableHead>
                          <TableHead className="w-[25%]">Результат</TableHead>
                          <TableHead className="w-[25%]">Статус</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.map((row, idx) => {
                          // Найти соответствующий indicator для статуса
                          const indicator = document.indicators?.find(i => 
                            i.name.toLowerCase().includes(row.param.toLowerCase().split('(')[0].trim().toLowerCase()) ||
                            row.param.toLowerCase().includes(i.name.toLowerCase().split('(')[0].trim().toLowerCase())
                          )
                          
                          return (
                            <TableRow key={idx} className={indicator && !indicator.isNormal ? 'bg-red-50/50' : ''}>
                              <TableCell className="font-medium">{row.param}</TableCell>
                              <TableCell className="font-bold">{row.value}</TableCell>
                              <TableCell>
                                {indicator ? (
                                  <div className="flex items-center gap-2">
                                    {indicator.isNormal ? (
                                      <>
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span className="text-xs text-green-600">Норма</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="h-4 w-4 text-destructive" />
                                        <span className="text-xs text-destructive">Отклонение</span>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                      {document.rawText}
                    </pre>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* Document Preview */}
          {document.fileType.includes('image') && (
            <Card>
              <CardHeader>
                <CardTitle>Просмотр документа</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={document.fileUrl}
                  alt={document.fileName}
                  className="w-full rounded-lg border"
                />
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <a href={document.fileUrl} download={document.fileName} className="flex-1">
              <Button className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Скачать
              </Button>
            </a>
            {isDoctorReport && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  try { window.print() } catch {}
                }}
              >
                Печать
              </Button>
            )}
            <Link href="/documents" className="flex-1">
              <Button variant="outline" className="w-full">
                Закрыть
              </Button>
            </Link>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isDeleting}
              onClick={async () => {
                if (!confirm('Удалить документ?')) return
                try {
                  setIsDeleting(true)
                  const res = await fetch(`/api/documents/${document.id}`, { method: 'DELETE' })
                  if (res.ok) {
                    router.push('/documents')
                  }
                } catch (e) {
                  console.error('Delete document error', e)
                } finally {
                  setIsDeleting(false)
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

