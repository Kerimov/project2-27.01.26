import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Trash2 } from 'lucide-react'

const APP_NAME = 'Медицинский ассистент (ПМА)'
const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@example.com'

export default function DeleteAccountPage() {
  const mailSubject = encodeURIComponent('Запрос на удаление аккаунта ПМА')
  const mailBody = encodeURIComponent(
    [
      'Здравствуйте!',
      '',
      'Прошу удалить мой аккаунт и связанные данные в приложении «Медицинский ассистент (ПМА)».',
      '',
      'Email аккаунта: ',
      '',
      'Комментарий (необязательно): ',
    ].join('\n')
  )
  const mailtoHref = `mailto:${supportEmail}?subject=${mailSubject}&body=${mailBody}`

  return (
    <main className="container max-w-3xl py-10 md:py-14">
      <div className="mb-8 text-center">
        <Trash2 className="mx-auto mb-4 h-12 w-12 text-primary" aria-hidden />
        <h1 className="text-3xl font-bold tracking-tight">Удаление аккаунта</h1>
        <p className="mt-2 text-muted-foreground">
          {APP_NAME} — персональный медицинский кабинет (веб и мобильное приложение для Android).
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Как запросить удаление</CardTitle>
          <CardDescription>
            Страница доступна без входа в аккаунт. Запрос обрабатывается вручную в течение 30 дней.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Отправьте письмо с адреса, указанного при регистрации, на{' '}
              <a className="font-medium text-primary hover:underline" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </li>
            <li>В теме укажите: «Запрос на удаление аккаунта ПМА».</li>
            <li>В тексте напишите email аккаунта, который нужно удалить.</li>
          </ol>
          <Button asChild className="w-full sm:w-auto">
            <a href={mailtoHref}>
              <Mail className="mr-2 h-4 w-4" aria-hidden />
              Написать запрос на удаление
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Какие данные удаляются</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>учётная запись (имя, email, роль);</li>
            <li>дневник здоровья, напоминания, записи к врачу;</li>
            <li>загруженные документы и результаты анализов;</li>
            <li>данные плана ухода и история чата с ИИ-ассистентом на сервере.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Что может сохраниться</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Резервные копии на сервере и журналы безопасности могут храниться до 90 дней, после чего
            удаляются автоматически, если иное не требуется законом.
          </p>
          <p>
            Данные, которые вы сами добавили в календарь телефона через приложение, нужно удалить
            отдельно в приложении «Календарь» на устройстве.
          </p>
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Войти в кабинет
        </Link>
        {' · '}
        <Link href="/privacy" className="text-primary hover:underline">
          Политика конфиденциальности
        </Link>
      </p>
    </main>
  )
}
