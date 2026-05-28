'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bot, Check, Loader2, MessageSquare, Settings } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ProjectModel = {
  provider: string
  model: string
  label: string
  description: string
  ready: boolean
  active: boolean
}

type AssistantChatMode = 'hybrid' | 'agent'

type AiSettingsResponse = {
  settings: {
    provider: string
    model: string
    modelLabel: string
    source: string
    assistantChatMode?: AssistantChatMode
    assistantLlmRouter?: boolean
    assistantChatModeSource?: 'database' | 'env'
    assistantLlmRouterSource?: 'database' | 'env'
    agentAvailable?: boolean
  }
  models: ProjectModel[]
  vision: { label: string; model: string; description: string; ready: boolean }
  envHints: { deepseek: boolean; ollama: boolean }
  ollama?: {
    enabled: boolean
    reachable: boolean
    baseUrl: string
    chatModel: string
    visionModel: string
  }
}

export default function AdminSettingsPage() {
  const { user, isLoading, token } = useAuth()
  const router = useRouter()
  const isAdmin = !!(user && user.role === 'ADMIN')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<AiSettingsResponse | null>(null)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [assistantChatMode, setAssistantChatMode] = useState<AssistantChatMode>('hybrid')
  const [assistantLlmRouter, setAssistantLlmRouter] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
    else if (!isLoading && user && !isAdmin) router.push('/dashboard')
  }, [user, isLoading, router, isAdmin])

  const load = useCallback(async () => {
    if (!token || !isAdmin) return
    try {
      setLoading(true)
      const res = await fetch('/api/admin/ai-settings', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Не удалось загрузить настройки')
      const json: AiSettingsResponse = await res.json()
      setData(json)
      setProvider(json.settings.provider)
      setModel(json.settings.model)
      setAssistantChatMode(json.settings.assistantChatMode === 'agent' ? 'agent' : 'hybrid')
      setAssistantLlmRouter(Boolean(json.settings.assistantLlmRouter))
    } catch (e: unknown) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Ошибка загрузки',
      })
    } finally {
      setLoading(false)
    }
  }, [token, isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (!token || !provider || !model) return
    try {
      setSaving(true)
      setMessage(null)
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          model,
          assistantChatMode,
          assistantLlmRouter,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Ошибка сохранения')
      setMessage({ type: 'success', text: json.message || 'Сохранено' })
      await load()
    } catch (e: unknown) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Ошибка сохранения',
      })
    } finally {
      setSaving(false)
    }
  }

  const agentAvailable = data?.settings.agentAvailable ?? false
  const activeChatMode = data?.settings.assistantChatMode === 'agent' ? 'agent' : 'hybrid'
  const activeLlmRouter = Boolean(data?.settings.assistantLlmRouter)

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !isAdmin) return null

  return (
    <div className="web-page">
      <main className="web-container max-w-2xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в админ-панель
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full gradient-primary mb-4 shadow-medical">
            <Settings className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">AI — настройки</h1>
          <p className="text-muted-foreground">
            Модель для чата и режимы работы ассистента в личном кабинете
          </p>
        </div>

        <Card className="glass-effect border-0 shadow-medical mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Основная модель
            </CardTitle>
            <CardDescription>
              {data?.settings.modelLabel ? (
                <>
                  Сейчас активна: <strong>{data.settings.modelLabel}</strong>
                </>
              ) : (
                'Выберите модель'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {data?.models.map((m) => (
                <button
                  key={`${m.provider}-${m.model}`}
                  type="button"
                  onClick={() => {
                    setProvider(m.provider)
                    setModel(m.model)
                    if (m.provider !== 'deepseek' && assistantChatMode === 'agent') {
                      setAssistantChatMode('hybrid')
                    }
                  }}
                  className={cn(
                    'text-left rounded-xl border px-4 py-4 transition-all hover:border-primary/50',
                    provider === m.provider && model === m.model
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-border bg-white/80'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{m.label}</span>
                    {m.active && (
                      <span className="text-xs text-primary font-medium">активна</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                  <p className="text-xs mt-1">
                    {m.ready ? (
                      <span className="text-green-700">Готова к работе</span>
                    ) : (
                      <span className="text-amber-700">Нужна настройка .env / Ollama</span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-0 shadow-medical mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5 text-primary" />
              Чат ассистента (ЛК пациента)
            </CardTitle>
            <CardDescription>
              Сохраняется в базе. Сейчас: режим{' '}
              <strong>{activeChatMode === 'agent' ? 'Agent' : 'Гибрид'}</strong>
              {', LLM-router '}
              <strong>{activeLlmRouter ? 'включён' : 'выключен'}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="font-semibold text-sm">Режим маршрутизации</p>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setAssistantChatMode('hybrid')}
                  className={cn(
                    'text-left rounded-lg border px-3 py-3 text-sm transition-all',
                    assistantChatMode === 'hybrid'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-border bg-white/80'
                  )}
                >
                  <span className="font-medium">Гибрид</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Быстрые правила для записей, дневника и списков. Подходит для продакшена.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => agentAvailable && setAssistantChatMode('agent')}
                  disabled={!agentAvailable}
                  className={cn(
                    'text-left rounded-lg border px-3 py-3 text-sm transition-all',
                    assistantChatMode === 'agent'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-border bg-white/80',
                    !agentAvailable && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="font-medium">Agent (DeepSeek tools)</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Модель сама выбирает инструменты (до 3 шагов). Только при активном DeepSeek Chat.
                  </p>
                  {!agentAvailable && (
                    <p className="text-xs text-amber-700 mt-1">
                      Выберите DeepSeek Chat выше и задайте DEEPSEEK_API_KEY в .env.local
                    </p>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-sm">LLM-router (уточнение intent)</p>
              <p className="text-xs text-muted-foreground">
                Если правила не уверены, короткий запрос к модели уточняет намерение (дневник vs врач и т.д.).
                Имеет смысл в режиме «Гибрид».
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssistantLlmRouter(false)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                    !assistantLlmRouter
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-border bg-white/80'
                  )}
                >
                  Выключен
                </button>
                <button
                  type="button"
                  onClick={() => setAssistantLlmRouter(true)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                    assistantLlmRouter
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-border bg-white/80'
                  )}
                >
                  Включён
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-0 shadow-medical mb-6">
          <CardContent className="pt-6 space-y-4">
            {message && (
              <p
                className={
                  message.type === 'success' ? 'text-green-600 text-sm' : 'text-red-600 text-sm'
                }
              >
                {message.text}
              </p>
            )}

            <Button
              className="w-full gradient-primary text-white"
              onClick={handleSave}
              disabled={saving || !provider || !model}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Сохранить все настройки
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Перезапуск сервера не нужен — настройки применяются сразу.
            </p>
          </CardContent>
        </Card>

        {data?.ollama && (
          <Card className="glass-effect border-0 shadow-medical mb-6">
            <CardHeader>
              <CardTitle className="text-base">Ollama — проверка</CardTitle>
              <CardDescription>
                {data.ollama.reachable
                  ? 'Сервер отвечает, можно переключаться на Ollama Llama 3.2'
                  : 'Запустите ollama serve и выполните: bash scripts/ollama-setup.sh'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>URL: {data.ollama.baseUrl}</p>
              <p>Чат: {data.ollama.chatModel}</p>
              <p>
                OCR фото: {data.vision?.label} —{' '}
                {data.vision?.ready ? 'модель установлена' : 'нужен ollama pull llava'}
              </p>
            </CardContent>
          </Card>
        )}

        {data?.vision && (
          <Card className="glass-effect border-0 shadow-medical">
            <CardHeader>
              <CardTitle className="text-base">LLaVA (OCR)</CardTitle>
              <CardDescription>
                Работает при загрузке фото документов, даже если чат на DeepSeek
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{data.vision.description}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
