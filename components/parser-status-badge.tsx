'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Brain, Code, Sparkles, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ParserStatus {
  available: boolean
  provider: 'ollama' | 'anthropic' | 'local' | 'regex'
  model?: string
  message: string
}

export function ParserStatusBadge() {
  const [status, setStatus] = useState<ParserStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    fetch('/api/parser-status')
      .then(res => res.json())
      .then(data => {
        setStatus(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch parser status:', err)
        setLoading(false)
      })
  }, [])

  if (loading || !status) return null

  const getIcon = () => {
    switch (status.provider) {
      case 'ollama':
      case 'anthropic':
        return <Sparkles className="h-3 w-3" />
      case 'local':
        return <Brain className="h-3 w-3" />
      default:
        return <Code className="h-3 w-3" />
    }
  }

  const getVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    return status.available ? 'default' : 'secondary'
  }

  const getLabel = () => {
    switch (status.provider) {
      case 'ollama':
        return `AI: Ollama ${status.model || ''}`
      case 'anthropic':
        return `AI: Claude ${status.model || ''}`
      case 'local':
        return `AI: Локальная (${status.model || 'Ollama'})`
      default:
        return 'Базовый парсер'
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge 
          variant={getVariant()} 
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={() => setShowDetails(!showDetails)}
        >
          {getIcon()}
          <span className="text-xs">{getLabel()}</span>
          <Info className="h-3 w-3 ml-1" />
        </Badge>
      </div>
      
      {showDetails && (
        <Alert>
          <AlertDescription className="text-sm">
            <p className="font-medium mb-1">{status.message}</p>
            {!status.available && (
              <p className="text-xs text-muted-foreground mt-2">
                📘 См. <code className="bg-muted px-1 rounded">ENV_SETUP.md</code> для настройки AI-парсера
              </p>
            )}
            {status.available && (
              <p className="text-xs text-muted-foreground mt-2">
                ✨ Работает с любыми форматами лабораторий
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

