'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, Send } from 'lucide-react'

export default function PrintPrescriptionSheetClient() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()
  const sp = useSearchParams()

  const patientId = sp.get('patientId') || ''

  const [markdown, setMarkdown] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  useEffect(() => {
    async function load() {
      if (!token || !patientId) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/doctor/prescriptions/sheet?patientId=${encodeURIComponent(patientId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Ошибка')
        setMarkdown(String(data?.markdown || ''))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        setLoading(false)
      }
    }
    if (user && token && patientId) load()
  }, [user, token, patientId])

  async function sendToPatient() {
    if (!token) return
    setBusy(true)
    try {
      const res = await fetch('/api/doctor/prescriptions/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ patientId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Ошибка')
      alert(`Отправлено пациенту как документ: ${data?.fileName || ''}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  if (!patientId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Нужен patientId в query параметре.</div>
      </div>
    )
  }

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8 space-y-4 max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Лист назначений</h1>
            <p className="text-muted-foreground">Печать/экспорт и отправка пациенту.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/doctor/prescriptions">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => { try { window.print() } catch {} }} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Печать
          </Button>
          <Button onClick={sendToPatient} disabled={busy} className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {busy ? 'Отправляю…' : 'Отправить пациенту'}
          </Button>
        </div>

        <Card className="bg-white">
          <CardHeader className="print:hidden">
            <CardTitle>Preview</CardTitle>
            <CardDescription>Для PDF используйте “Печать” → “Сохранить как PDF”.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Загрузка…</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 border rounded p-4 max-h-[70vh] overflow-auto print:max-h-none print:border-0 print:bg-transparent">
{markdown || '—'}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


