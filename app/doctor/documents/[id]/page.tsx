'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Download } from 'lucide-react'

type Doc = {
  id: string
  fileName: string
  fileType: string
  fileUrl: string
  uploadDate: string
  category?: string | null
  studyType?: string | null
  studyDate?: string | null
  laboratory?: string | null
  doctor?: string | null
  findings?: string | null
  rawText?: string | null
  indicators?: any
}

export default function DoctorDocumentViewPage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const { user, isLoading, token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<Doc | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const auth = token || lsToken
        const res = await fetch(`/api/doctor/documents/${params.id}`, {
          headers: auth ? { Authorization: `Bearer ${auth}` } : undefined,
          credentials: 'include'
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Ошибка')
        setDoc(data?.document || null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        setLoading(false)
      }
    })()
  }, [user, token, params.id])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка документа…</div>
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="web-page">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Документ (просмотр)</h1>
            <p className="text-muted-foreground">Read-only доступ для врача.</p>
          </div>
          <Link href="/doctor">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              В кабинет
            </Button>
          </Link>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {!doc ? null : (
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {doc.fileName}
                </span>
                <Badge variant="secondary">{doc.category || 'document'}</Badge>
              </CardTitle>
              <CardDescription>
                {doc.studyType ? `Тип: ${doc.studyType} • ` : ''}{new Date(doc.uploadDate).toLocaleString('ru-RU')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Открыть/скачать
                  </Button>
                </a>
              </div>

              {(doc.category || '').toLowerCase() === 'medical_report' || doc.fileType === 'text/markdown' ? (
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 border rounded p-4 max-h-[70vh] overflow-auto">
{doc.findings || doc.rawText || '—'}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Документ откроется в новой вкладке по кнопке “Открыть/скачать”.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}


