'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Menu, Settings, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

type AppTopBarProps = {
  onMenuClick: () => void
  showAdminLink?: boolean
}

export function AppTopBar({ onMenuClick, showAdminLink }: AppTopBarProps) {
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const displayName = user?.name?.trim() || user?.email || 'Пользователь'

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/95 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenuClick} aria-label="Открыть меню">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 hidden sm:block">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">Персональный медицинский ассистент</p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Link href="/reminders" title="Напоминания">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-medical-coral" />
          </Button>
        </Link>
        <Link href="/settings" title="Настройки">
          <Button variant="ghost" size="icon" aria-label="Настройки">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
        {showAdminLink && (
          <Link href="/admin" title="Админ-панель">
            <Button variant="ghost" size="icon" aria-label="Админ-панель">
              <Shield className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="ml-1 hidden sm:inline-flex border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="sm:hidden text-destructive"
          aria-label="Выйти"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
