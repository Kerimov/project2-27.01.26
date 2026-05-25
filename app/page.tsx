import { Button } from '@/components/ui/button'
import { Footer } from '@/components/Footer'
import {
  Activity,
  Bell,
  Calendar,
  CheckCircle2,
  FileText,
  HeartPulse,
  Shield,
  Sparkles,
  TrendingUp,
  UploadCloud,
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

  const features = [
    {
      icon: UploadCloud,
      title: 'Документы и OCR',
      text: 'Загружайте PDF и фото анализов, а система извлечёт показатели и сохранит историю.',
    },
    {
      icon: Sparkles,
      title: 'AI-разбор',
      text: 'Понятные пояснения к отклонениям, динамике и дальнейшим шагам без медицинского жаргона.',
    },
    {
      icon: Bell,
      title: 'Напоминания',
      text: 'Лекарства, повторные анализы и задачи ухода собраны в одном календаре.',
    },
    {
      icon: Calendar,
      title: 'Записи к врачам',
      text: 'Планируйте визиты, храните историю приёмов и готовьте анкету перед консультацией.',
    },
    {
      icon: TrendingUp,
      title: 'Динамика показателей',
      text: 'Смотрите изменения лабораторных значений во времени и оценивайте тренды.',
    },
    {
      icon: Shield,
      title: 'Личный медицинский контур',
      text: 'Профиль, аллергии, цели и хронические состояния помогают персонализировать рекомендации.',
    },
  ]

  return (
    <div className="web-page flex flex-col">
      <main className="flex-1">
        <section className="web-container">
          <div className="web-hero grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="relative z-10 space-y-7">
              <div className="web-kicker">
                <Sparkles className="h-4 w-4" />
                AI-помощник для личного здоровья
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
                  Персональный медицинский ассистент
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                  Светлый, спокойный интерфейс для документов, анализов, записей, напоминаний и понятных AI-рекомендаций.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Начать бесплатно
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Войти в кабинет
                  </Button>
                </Link>
              </div>
              <div className="grid gap-3 pt-2 text-sm text-muted-foreground sm:grid-cols-3">
                {['Анализы', 'Документы', 'План ухода'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-full bg-muted px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <div className="web-card p-5">
                <div className="rounded-3xl bg-muted p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Сегодня</p>
                      <p className="text-2xl font-extrabold">Состояние под контролем</p>
                    </div>
                    <div className="web-icon-bubble">
                      <HeartPulse className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      ['Общий анализ крови', 'Норма', 'bg-green-100 text-green-800'],
                      ['Приём терапевта', 'Завтра 12:30', 'bg-blue-100 text-blue-800'],
                      ['Повторить ферритин', 'Через 2 недели', 'bg-purple-100 text-purple-800'],
                    ].map(([title, status, cls]) => (
                      <div key={title} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <Activity className="h-5 w-5 text-primary" />
                          <span className="font-semibold">{title}</span>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="web-container pt-4">
          <div className="text-center mb-12">
            <div className="web-kicker mx-auto mb-4">Возможности</div>
            <h2 className="web-page-title">
              Всё главное — в одном медицинском кабинете
            </h2>
            <p className="web-page-subtitle mx-auto">
              Дизайн ориентирован на чтение: мягкие поверхности, крупные поля, понятные статусы и минимум визуального шума.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="web-card web-card-hover p-6">
                  <div className="web-icon-bubble mb-5">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-extrabold">{feature.title}</h3>
                  <p className="leading-7 text-muted-foreground">{feature.text}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="web-container pt-4">
          <div className="web-card grid gap-8 p-6 md:p-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="web-kicker mb-4">Как работает</div>
              <h2 className="text-3xl font-extrabold tracking-tight">От загрузки документа до плана действий</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:col-span-2">
              {[
                ['01', 'Загрузите анализ', 'PDF, фото или ручной ввод показателей.'],
                ['02', 'Получите объяснение', 'AI выделит отклонения и переведёт результат на простой язык.'],
                ['03', 'Следите за планом', 'Создавайте задачи, напоминания и контрольные сроки.'],
              ].map(([step, title, text]) => (
                <div key={step} className="rounded-2xl bg-muted p-5">
                  <div className="mb-4 text-sm font-extrabold text-primary">{step}</div>
                  <h3 className="mb-2 font-extrabold">{title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="web-container">
          <div className="rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground shadow-medical-lg md:px-10">
            <h2 className="text-3xl md:text-5xl font-bold">
              Начните заботиться о здоровье без перегруженного интерфейса
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Веб-кабинет и мобильные приложения теперь оформлены в единой спокойной системе.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-7">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="text-lg">
                  Создать аккаунт
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-lg bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Войти
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

