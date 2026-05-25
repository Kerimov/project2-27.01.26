import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Footer } from '@/components/Footer'
import { 
  Activity, 
  Bell, 
  Calendar, 
  FileText, 
  Heart, 
  Shield, 
  Smartphone,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export default function Home() {
  // Редирект врачей на их дашборд
  try {
    const token = cookies().get('token')?.value
    if (token) {
      const payload = verifyToken(token)
      if (payload && (payload as any).role === 'DOCTOR') {
        if (typeof window !== 'undefined') {
          // client-side fallback
          window.location.replace('/doctor')
        }
      }
    }
  } catch {}
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container py-20 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
                ПМА — Ваше здоровье — наш приоритет
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Персональный Медицинский Ассистент
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground font-semibold">
                ПМА — всё для заботы о вашем здоровье
              </p>
              <p className="text-xl text-muted-foreground">
                Управляйте своим здоровьем легко и эффективно. Напоминания о лекарствах, запись к врачам, 
                история анализов — всё в одном месте.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register">
                  <Button size="lg" className="text-lg">
                    Начать бесплатно
                  </Button>
                </Link>
                <Link href="#features">
                  <Button size="lg" variant="outline" className="text-lg">
                    Узнать больше
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-8 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span>Безопасно</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span>10K+ пользователей</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-12 flex items-center justify-center">
                <Activity className="w-full h-full text-primary opacity-20" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container py-20 bg-muted/30">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Всё для вашего здоровья
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Современные инструменты для управления здоровьем в одном приложении
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border border-border hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader>
                <Bell className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Напоминания о лекарствах</CardTitle>
                <CardDescription>
                  Никогда не забывайте принять лекарство вовремя с умными напоминаниями
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader>
                <Calendar className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Запись к врачам</CardTitle>
                <CardDescription>
                  Удобное планирование визитов и отслеживание предстоящих приемов
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader>
                <FileText className="h-12 w-12 text-primary mb-4" />
                <CardTitle>История анализов</CardTitle>
                <CardDescription>
                  Храните все медицинские документы и результаты анализов в одном месте
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader>
                <Heart className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Дневник здоровья</CardTitle>
                <CardDescription>
                  Отслеживайте симптомы, самочувствие и показатели здоровья ежедневно
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Аналитика и графики</CardTitle>
                <CardDescription>
                  Визуализация данных о здоровье помогает лучше понять динамику
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-border hover:border-primary/40 transition-colors shadow-sm">
              <CardHeader>
                <Smartphone className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Мобильное приложение</CardTitle>
                <CardDescription>
                  Доступ к вашим данным в любое время с любого устройства
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="container py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-5xl font-bold">
                Почему выбирают нас?
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Безопасность данных</h3>
                    <p className="text-muted-foreground">
                      Все данные шифруются и хранятся в соответствии с международными стандартами
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Быстро и просто</h3>
                    <p className="text-muted-foreground">
                      Интуитивный интерфейс делает управление здоровьем максимально комфортным
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Поддержка 24/7</h3>
                    <p className="text-muted-foreground">
                      Наша команда всегда готова помочь вам с любыми вопросами
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-tr from-primary/20 via-transparent to-primary/10 p-12">
                <div className="w-full h-full rounded-xl border-2 border-primary/20 flex items-center justify-center">
                  <Heart className="w-32 h-32 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container py-20 bg-primary text-primary-foreground rounded-3xl my-20">
          <div className="text-center space-y-6 py-12">
            <h2 className="text-3xl md:text-5xl font-bold">
              Начните заботиться о своем здоровье уже сегодня
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Присоединяйтесь к тысячам людей, которые доверяют нам свое здоровье
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="text-lg">
                  Создать аккаунт
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="text-lg bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Связаться с нами
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

