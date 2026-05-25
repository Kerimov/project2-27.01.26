'use client'

import Link from 'next/link'
import { Menu, User, Bell, Settings, Shield, Stethoscope, ArrowLeft, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Logo, LogoCompact } from '@/components/Logo'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDoctor, setIsDoctor] = useState(false)
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()

  // Проверяем, является ли пользователь врачом
  React.useEffect(() => {
    // Если у пользователя роль DOCTOR — показываем пункт меню "Врач"
    // Проверку профиля врача делаем отдельно на соответствующих страницах
    if (user?.role === 'DOCTOR') {
      setIsDoctor(true)
    } else {
      setIsDoctor(false)
    }
  }, [user])

  const checkDoctorStatus = async () => {
    // Оставлено для совместимости: можно вызвать при переходе в раздел врача,
    // чтобы проверить, создан ли профиль и управлять онбордингом.
    try {
      const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const token = lsToken || undefined
      await fetch('/api/doctor/profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include'
      })
    } catch {}
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 w-full glass-effect border-b border-border/80 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo size="md" showText={false} />
          <div className="ml-3 hidden sm:block">
            <span className="font-bold text-xl text-gradient-brand">
              Персональный Медицинский Ассистент
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
          {!isDoctor && (
            <>
              <Link href="/" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary">Главная</Link>
              {user && (
                <>
                  <Link href="/documents" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary">Документы</Link>
                  <Link href="/analyses" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary">Анализы</Link>
                  <Link href="/medications" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary">Лекарства</Link>
                  <Link href="/care-plan" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary">План</Link>
                  <Link href="/profile" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary">Профиль</Link>
                  <Link href="/knowledge-base" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    База знаний
                  </Link>
                </>
              )}
            </>
          )}
          {/* Кнопка "Назад" убрана из шапки; показывается в разделах */}
          {/* Ссылка "Врач" скрыта: достаточно кнопки "Личный кабинет" */}
          {user && user.role === 'ADMIN' && (
            <Link href="/admin" className="px-3 py-2 rounded-lg transition-all hover:bg-primary/10 hover:text-primary flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Админ
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-3">
          {!isLoading && (
            user ? (
              <div className="hidden md:flex items-center gap-2">
                {/* Уведомления */}
                <Link href="/reminders">
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-medical-coral rounded-full animate-pulse"></span>
                  </Button>
                </Link>
                
                {/* Настройки */}
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
                
                {/* Личный кабинет */}
                <Link href={isDoctor ? "/doctor" : "/dashboard"}>
                  <Button className="gradient-primary text-white hover:opacity-90 transition-opacity">
                    <User className="mr-2 h-4 w-4" />
                    Личный кабинет
                  </Button>
                </Link>
                
                {/* Выход */}
                <Button variant="outline" onClick={handleLogout} className="border-medical-red text-medical-red hover:bg-medical-red hover:text-white">
                  Выйти
                </Button>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="hidden md:inline-flex">
                    Войти
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="hidden md:inline-flex gradient-primary text-white hover:opacity-90">
                    Регистрация
                  </Button>
                </Link>
              </>
            )
          )}
          
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t glass-effect">
          <nav className="container flex flex-col space-y-2 py-4 animate-slide-up">
            {!isDoctor && (
              <Link 
                href="/" 
                className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Главная
              </Link>
            )}
            {user && (
              <>
                {!isDoctor && (
                  <>
                    <Link href="/documents" className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Документы</Link>
                    <Link href="/analyses" className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Анализы</Link>
                    <Link href="/medications" className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Лекарства</Link>
                    <Link href="/care-plan" className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary" onClick={() => setMobileMenuOpen(false)}>План</Link>
                    <Link href="/profile" className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary" onClick={() => setMobileMenuOpen(false)}>Профиль</Link>
                    <Link href="/knowledge-base" className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                      <BookOpen className="h-4 w-4" />
                      База знаний
                    </Link>
                  </>
                )}
                {/* Ссылка "Врач" скрыта в мобильном меню */}
                <Link 
                  href="/reminders" 
                  className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Bell className="h-4 w-4" />
                  Напоминания
                </Link>
                {user && user.role === 'ADMIN' && (
                  <Link 
                    href="/admin" 
                    className="px-4 py-3 rounded-lg transition-all hover:bg-primary/10 hover:text-primary flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield className="h-4 w-4" />
                    Админ-панель
                  </Link>
                )}
              </>
            )}
            
            <div className="flex flex-col space-y-2 pt-4 border-t">
              {!isLoading && (
                user ? (
                  <>
                    {/* Кнопка "Назад" убрана из мобильного меню; показывается в разделах */}
                    <Link href={isDoctor ? "/doctor" : "/dashboard"} onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full gradient-primary text-white">
                        <User className="mr-2 h-4 w-4" />
                        Личный кабинет
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      className="w-full border-medical-red text-medical-red hover:bg-medical-red hover:text-white" 
                      onClick={handleLogout}
                    >
                      Выйти
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full">Войти</Button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full gradient-primary text-white">Регистрация</Button>
                    </Link>
                  </>
                )
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}


