import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

const APP_NAME = 'Медицинский ассистент (ПМА)'

export default function PrivacyPage() {
  return (
    <main className="container max-w-3xl py-10 md:py-14">
      <div className="mb-8 text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-primary" aria-hidden />
        <h1 className="text-3xl font-bold tracking-tight">Политика конфиденциальности</h1>
        <p className="mt-2 text-muted-foreground">{APP_NAME}</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Какие данные мы обрабатываем</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Имя, email, пароль (в виде хэша), медицинские записи, документы, анализы, дневник, напоминания, записи к врачу, сообщения ИИ-ассистенту.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Как используем данные</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Для работы личного кабинета, напоминаний, записи к врачу и функций ИИ. Передача по сети — только по HTTPS.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Удаление данных</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Запросить удаление аккаунта и связанных данных можно на странице{' '}
            <Link href="/delete-account" className="text-primary hover:underline">
              удаления аккаунта
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
