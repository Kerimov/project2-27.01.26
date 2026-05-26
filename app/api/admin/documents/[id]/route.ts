import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Использует cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверяем авторизацию
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем права администратора
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'test@pma.ru,admin@example.com').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!adminUser || !adminEmails.includes(adminUser.email.toLowerCase())) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
    }

    const documentId = params.id

    // Проверяем, что документ существует
    const documentToDelete = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!documentToDelete) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    // Удаляем документ (каскадное удаление настроено в Prisma)
    await prisma.document.delete({
      where: { id: documentId }
    })

    return NextResponse.json({ message: 'Документ успешно удален' })

  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
