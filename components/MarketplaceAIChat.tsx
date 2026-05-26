'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, Loader2, Sparkles, Globe, MapPin, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DiscoveredCompany } from '@/lib/marketplace-discover'

export type { DiscoveredCompany }

type MarketplaceAIChatProps = {
  cityHint?: string
  onResults?: (companies: DiscoveredCompany[]) => void
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const sourceLabel: Record<string, string> = {
  catalog: 'Каталог',
  openstreetmap: 'Карта',
  web: 'Интернет',
}

export function MarketplaceAIChat({ cityHint, onResults }: MarketplaceAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Я помогу найти клиники и лаборатории: сначала в нашем каталоге, затем в OpenStreetMap и в открытых источниках в интернете. Напишите, что ищете, например: «Стоматология в Казани» или «Лаборатории с анализами».',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastCompanies, setLastCompanies] = useState<DiscoveredCompany[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, lastCompanies])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return

      const userMsg: ChatMessage = { id: String(Date.now()), role: 'user', content: text.trim() }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setLoading(true)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/marketplace/ai-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            message: text.trim(),
            city: cityHint || undefined,
            includeWeb: true,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Ошибка поиска')

        const companies: DiscoveredCompany[] = Array.isArray(data.companies) ? data.companies : []
        setLastCompanies(companies)
        onResults?.(companies)

        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: data.response || 'Готово.',
          },
        ])
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: e instanceof Error ? e.message : 'Не удалось выполнить поиск',
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [loading, cityHint, onResults]
  )

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI-поиск клиник
        </CardTitle>
        <CardDescription>
          Поиск по каталогу PMA, картам и интернету{cityHint ? ` · город: ${cityHint}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-52 overflow-y-auto space-y-2 rounded-lg border bg-background/80 p-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-sm rounded-lg px-3 py-2 ${
                m.role === 'user' ? 'bg-primary text-primary-foreground ml-8' : 'bg-muted mr-4'
              }`}
            >
              {m.role === 'assistant' && <Bot className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />}
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ищу в каталоге и в интернете…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {lastCompanies.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Найденные варианты</p>
            <div className="grid gap-2 max-h-40 overflow-y-auto">
              {lastCompanies.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.city || 'Город не указан'}
                      {c.address ? ` · ${c.address}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {sourceLabel[c.source] || c.source}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => sendMessage(cityHint ? `Клиники в ${cityHint}` : 'Покажи клиники')}
          >
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Клиники
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => sendMessage(cityHint ? `Лаборатории в ${cityHint}` : 'Лаборатории')}
          >
            Лаборатории
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => sendMessage('Стоматология')}
          >
            Стоматология
          </Button>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage(input)
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напр. кардиолог в Москве, МРТ, анализы крови…"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} size="icon">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Globe className="h-3 w-3" />
          <MapPin className="h-3 w-3" />
          Данные из открытых источников — проверяйте адрес и запись на сайте клиники.
        </p>
      </CardContent>
    </Card>
  )
}
