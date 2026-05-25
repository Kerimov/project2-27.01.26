'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Moon, Settings, Sun } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  applyThemeToDocument,
  getWebTheme,
  setWebTheme,
  type WebThemeScheme,
} from '@/lib/theme-store-web'

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [theme, setTheme] = useState<WebThemeScheme>('light')

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

  useEffect(() => {
    const saved = getWebTheme()
    setTheme(saved)
    applyThemeToDocument(saved)
  }, [])

  const pickTheme = (scheme: WebThemeScheme) => {
    setTheme(scheme)
    setWebTheme(scheme)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) return null

  const isAdmin = user.role === 'ADMIN'

  return (
    <div className="web-page">
      <div className="web-container max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            Настройки
          </h1>
          <p className="text-muted-foreground mt-1">
            Оформление интерфейса и служебные параметры аккаунта.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Оформление</CardTitle>
            <CardDescription>Светлая или тёмная тема для веб-интерфейса.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => pickTheme('light')}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                theme === 'light'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted/60'
              )}
            >
              <Sun className="h-4 w-4" />
              Светлая
            </button>
            <button
              type="button"
              onClick={() => pickTheme('dark')}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                theme === 'dark'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted/60'
              )}
            >
              <Moon className="h-4 w-4" />
              Тёмная
            </button>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI и модели
              </CardTitle>
              <CardDescription>Выбор провайдера и модели для всего проекта (только администратор).</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/settings">
                <Button variant="outline">Открыть настройки AI</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href={user.role === 'DOCTOR' ? '/doctor' : '/dashboard'}>
            <Button variant="ghost">В личный кабинет</Button>
          </Link>
          {user.role !== 'DOCTOR' && user.role !== 'ADMIN' && (
            <Link href="/profile">
              <Button variant="outline">Профиль пациента</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
