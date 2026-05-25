'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function NewCarePlanTaskPage() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Укажите название задачи')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/care-plan/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          title: trimmed,
          description: description.trim() || undefined,
          dueAt: dueDate.trim() ? new Date(`${dueDate.trim()}T12:00:00`).toISOString() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Не удалось создать задачу')
      router.push('/diary?tab=plan')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="web-page">
      <div className="web-container max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/diary?tab=plan">
            <Button variant="ghost" size="icon" aria-label="Назад к плану">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Новая задача</h1>
            <p className="text-sm text-muted-foreground">Добавьте пункт в свой план действий.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Задача плана</CardTitle>
            <CardDescription>Например: сдать анализ, записаться к врачу, принять витамины.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Название *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Напр. Контроль давления 7 дней"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Дополнительные детали (необязательно)"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Срок</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={saving} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {saving ? 'Сохранение…' : 'Добавить'}
                </Button>
                <Link href="/diary?tab=plan">
                  <Button type="button" variant="outline">
                    Отмена
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
