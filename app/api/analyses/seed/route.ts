import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Использует cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/analyses/seed — создать демонстрационные анализы для текущего пользователя
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 })
    }

    const now = new Date()
    const demoItems = [
      {
        title: 'Общий анализ крови', type: 'Общий анализ крови', date: new Date(now.getTime() - 86400000 * 3),
        laboratory: 'Инвитро', doctor: 'Иванова И.И.', status: 'abnormal' as const, normalRange: 'См. по показателям',
        results: {
          'Гемоглобин': { value: 120, unit: 'г/л', normal: false },
          'Лейкоциты': { value: 6.2, unit: '10^9/л', normal: true }
        }
      },
      {
        title: 'Биохимический анализ крови', type: 'Биохимия', date: new Date(now.getTime() - 86400000 * 10),
        laboratory: 'Гемотест', doctor: 'Петров П.П.', status: 'abnormal' as const, normalRange: 'См. по показателям',
        results: {
          'Глюкоза': { value: 5.1, unit: 'ммоль/л', normal: true },
          'Холестерин': { value: 6.4, unit: 'ммоль/л', normal: false }
        }
      },
      {
        title: 'Витамин D (25-OH)', type: 'Витамин D', date: new Date(now.getTime() - 86400000 * 20),
        laboratory: 'Инвитро', doctor: 'Сидорова С.С.', status: 'abnormal' as const, normalRange: '30-100 нг/мл',
        results: {
          'Витамин D (25-OH)': { value: 18, unit: 'нг/мл', normal: false }
        }
      }
    ]

    for (const it of demoItems) {
      await prisma.analysis.create({
        data: {
          userId: payload.userId,
          title: it.title,
          type: it.type,
          date: it.date,
          laboratory: it.laboratory,
          doctor: it.doctor,
          results: JSON.stringify(it.results),
          normalRange: it.normalRange,
          status: it.status,
        }
      })
    }

    return NextResponse.json({ message: 'Демо‑анализы созданы', count: demoItems.length })
  } catch (error) {
    return NextResponse.json({ error: 'Не удалось создать демо-данные' }, { status: 500 })
  }
}


