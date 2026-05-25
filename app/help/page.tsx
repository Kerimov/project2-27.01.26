import { Footer } from '@/components/Footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, Database, HelpCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HelpPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 container py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <HelpCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">Помощь и FAQ</h1>
            <p className="text-xl text-muted-foreground">
              Ответы на часто задаваемые вопросы
            </p>
          </div>

          {/* Важное предупреждение */}
          <Card className="mb-8 border-2 border-yellow-500">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
                <CardTitle>⚠️ Важная информация о Demo версии</CardTitle>
              </div>
              <CardDescription>
                Текущая версия использует временное хранилище
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-50 rounded-lg space-y-2">
                <p className="font-semibold">Данные хранятся в памяти и удаляются при:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Перезапуске сервера разработки</li>
                  <li className="line-through opacity-50">Изменении файлов проекта (hot reload) - ИСПРАВЛЕНО!</li>
                  <li>Перезагрузке компьютера</li>
                </ul>
                <div className="mt-2 p-2 bg-green-100 rounded text-sm text-green-900">
                  ✅ <strong>Новое:</strong> Данные теперь сохраняются при hot reload!
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">В следующих версиях:</p>
                  <p className="text-muted-foreground">Будет интегрирована PostgreSQL база данных для постоянного хранения</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>❓ Не могу войти в систему</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Решение:</p>
                    <p className="text-muted-foreground">
                      Зарегистрируйтесь заново. При перезапуске сервера все данные удаляются.
                    </p>
                    <Link href="/register" className="inline-block mt-2">
                      <Button>Зарегистрироваться</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🔍 Как проверить, есть ли пользователи в системе?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                  Откройте отладочные эндпоинты (только для разработки):
                </p>
                <div className="space-y-2">
                  <div className="p-3 bg-muted rounded-md font-mono text-sm">
                    <a 
                      href="/api/debug/users" 
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      /api/debug/users
                    </a>
                    <p className="text-xs mt-1 text-muted-foreground">Список всех пользователей</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md font-mono text-sm">
                    <span className="text-destructive">/api/debug/clear-db</span>
                    <p className="text-xs mt-1 text-muted-foreground">POST запрос для очистки БД</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Вы увидите количество зарегистрированных пользователей и их данные (без паролей)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>💾 Когда появится постоянное хранилище?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                  Интеграция с PostgreSQL запланирована на следующий этап разработки:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>Установка и настройка Prisma ORM</li>
                  <li>Создание схемы базы данных</li>
                  <li>Миграции данных</li>
                  <li>Обновление API маршрутов</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🔐 Безопасны ли мои данные?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <p className="text-sm">Пароли хешируются с помощью bcrypt</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <p className="text-sm">Используются JWT токены для аутентификации</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <p className="text-sm">Валидация данных на клиенте и сервере</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <p className="text-sm">Данные хранятся в памяти (временно, для demo)</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🔄 Что делать, если сервер перезапустился?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  <p className="text-sm">
                    Просто создайте новый аккаунт - это займет 30 секунд
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Рекомендуемые тестовые данные:</p>
                  <div className="p-3 bg-muted rounded-md text-sm space-y-1 font-mono">
                    <p>Имя: Тестовый Пользователь</p>
                    <p>Email: test@example.com</p>
                    <p>Пароль: test123</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📚 Где найти больше информации?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <a 
                    href="https://github.com/yourusername/medical" 
                    className="p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-semibold">📖 README.md</p>
                    <p className="text-xs text-muted-foreground">Общая информация о проекте</p>
                  </a>
                  <a 
                    href="https://github.com/yourusername/medical" 
                    className="p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-semibold">🔧 TROUBLESHOOTING.md</p>
                    <p className="text-xs text-muted-foreground">Решение проблем</p>
                  </a>
                  <a 
                    href="https://github.com/yourusername/medical" 
                    className="p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-semibold">🔐 AUTHENTICATION.md</p>
                    <p className="text-xs text-muted-foreground">Документация по аутентификации</p>
                  </a>
                  <a 
                    href="https://github.com/yourusername/medical" 
                    className="p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <p className="font-semibold">🚀 QUICK_START.md</p>
                    <p className="text-xs text-muted-foreground">Быстрый старт</p>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Быстрые действия */}
          <div className="mt-12 p-6 bg-primary/5 rounded-xl border-2 border-primary/20">
            <h2 className="text-2xl font-bold mb-4 text-center">Быстрые действия</h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Создать новый аккаунт
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Попробовать войти
                </Button>
              </Link>
              <Link href="/">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto">
                  На главную
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

