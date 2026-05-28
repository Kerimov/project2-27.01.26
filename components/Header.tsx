'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'

/** Шапка для публичных страниц (главная, вход, регистрация). В приложении — AppShell. */
export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const enterHref = user?.role === 'DOCTOR' ? '/doctor' : '/dashboard'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-white/90 shadow-sm backdrop-blur-xl dark:bg-card/90">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <Logo size="md" showText={false} />
          <span className="hidden font-bold text-lg text-gradient-brand sm:inline truncate">
            Персональный Медицинский Ассистент
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {!isLoading && (
            user ? (
              <>
                <Link href={enterHref} className="hidden sm:inline-flex">
                  <Button>Перейти в приложение</Button>
                </Link>
                <Button variant="outline" onClick={handleLogout} className="hidden sm:inline-flex">
                  Выйти
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden sm:inline-flex">
                  <Button variant="ghost">Войти</Button>
                </Link>
                <Link href="/register" className="hidden sm:inline-flex">
                  <Button>Регистрация</Button>
                </Link>
              </>
            )
          )}

          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Меню"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-card sm:hidden">
          <nav className="container flex flex-col gap-2 py-4">
            {!isLoading && user ? (
              <>
                <Link href={enterHref} onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Перейти в приложение</Button>
                </Link>
                <Button variant="outline" className="w-full" onClick={handleLogout}>
                  Выйти
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">
                    Войти
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Регистрация</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
