'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, FileText, Loader2, Save } from 'lucide-react'

type Answers = {
  goal?: string
  complaints?: string
  duration?: string
  vitals?: string
  currentMedications?: string
  allergies?: string
  chronicConditions?: string
  questionsForDoctor?: string
  otherNotes?: string
}

export default function PreVisitPage({ params }: { params: { id: string } }) {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [documentId, setDocumentId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  const appointmentId = params.id

  async function load() {
    if (!token) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/previsit`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      if (data?.questionnaire?.answers) setAnswers(data.questionnaire.answers)
      setSubmittedAt(data?.questionnaire?.submittedAt ? String(data.questionnaire.submittedAt) : null)
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && token) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, appointmentId])

  const isSubmitted = useMemo(() => !!submittedAt, [submittedAt])

  async function save(submit: boolean) {
    if (!token) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/previsit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ answers, submitted: submit })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      setSubmittedAt(data?.questionnaire?.submittedAt ? String(data.questionnaire.submittedAt) : null)
      setMessage({ type: 'success', text: submit ? 'Анкета отправлена' : 'Черновик сохранён' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setSaving(false)
    }
  }

  async function generateDoctorReport() {
    if (!token) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/reports/doctor-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ appointmentId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      setDocumentId(data.documentId || null)
      setMessage({ type: 'success', text: 'Сводка для врача сформирована' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-3" />
          <div className="text-muted-foreground">Загрузка анкеты…</div>
        </div>
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="web-page">
      <div className="web-container space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Анкета перед визитом</h1>
            <p className="text-muted-foreground">Заполни кратко — это ляжет в сводку для врача.</p>
          </div>
          <Link href="/my-appointments">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              К моим записям
            </Button>
          </Link>
        </div>

        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : null}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-white/60">
          <CardHeader>
            <CardTitle className="text-lg">Вопросник (MVP)</CardTitle>
            <CardDescription>
              {isSubmitted ? `Отправлено: ${new Date(submittedAt as string).toLocaleString('ru-RU')}` : 'Можно сохранить как черновик.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Цель визита</div>
              <Input value={answers.goal || ''} onChange={(e) => setAnswers((p) => ({ ...p, goal: e.target.value }))} placeholder="Напр. разобрать анализы, подобрать терапию, контроль…" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Жалобы / что беспокоит</div>
              <Textarea value={answers.complaints || ''} onChange={(e) => setAnswers((p) => ({ ...p, complaints: e.target.value }))} placeholder="Коротко: что, где, как давно, что ухудшает/улучшает" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Длительность / динамика</div>
                <Input value={answers.duration || ''} onChange={(e) => setAnswers((p) => ({ ...p, duration: e.target.value }))} placeholder="Напр. 2 недели, усиливается вечером" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Показатели (если есть)</div>
                <Input value={answers.vitals || ''} onChange={(e) => setAnswers((p) => ({ ...p, vitals: e.target.value }))} placeholder="АД/пульс/температура/вес…" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Лекарства / БАДы сейчас</div>
              <Textarea value={answers.currentMedications || ''} onChange={(e) => setAnswers((p) => ({ ...p, currentMedications: e.target.value }))} placeholder="Название — дозировка — как принимаете" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Аллергии</div>
                <Input value={answers.allergies || ''} onChange={(e) => setAnswers((p) => ({ ...p, allergies: e.target.value }))} placeholder="Если нет — оставьте пустым" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Хронические состояния</div>
                <Input value={answers.chronicConditions || ''} onChange={(e) => setAnswers((p) => ({ ...p, chronicConditions: e.target.value }))} placeholder="Напр. гипертония, диабет…" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Вопросы врачу</div>
              <Textarea value={answers.questionsForDoctor || ''} onChange={(e) => setAnswers((p) => ({ ...p, questionsForDoctor: e.target.value }))} placeholder="Что важно обсудить на приёме?" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Дополнительно</div>
              <Textarea value={answers.otherNotes || ''} onChange={(e) => setAnswers((p) => ({ ...p, otherNotes: e.target.value }))} placeholder="Любые детали, которые помогут врачу" />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button disabled={saving} variant="outline" onClick={() => save(false)} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Сохранить черновик
              </Button>
              <Button disabled={saving} onClick={() => save(true)} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Отправить анкету
              </Button>
              <Button disabled={saving} variant="secondary" onClick={generateDoctorReport} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Сформировать сводку для врача
              </Button>
              {documentId && (
                <Link href={`/documents/${documentId}`}>
                  <Button variant="outline">Открыть сводку</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


