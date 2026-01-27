import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parse as parseCookies } from 'cookie'

// Маршрут использует request.headers (Authorization), поэтому помечаем его как динамический,
// чтобы Next.js не пытался выполнять его при статическом экспорте.
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Получаем всех врачей
    const doctors = await prisma.doctorProfile.findMany({
      where: {
        isActive: true
        // Временно убираем проверку isVerified для тестирования
        // isVerified: true
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        user: {
          name: 'asc'
        }
      }
    })

    const formattedDoctors = doctors.map(doctor => ({
      id: doctor.id,
      name: doctor.user.name,
      email: doctor.user.email,
      specialization: doctor.specialization,
      experience: doctor.experience,
      education: doctor.education,
      phone: doctor.phone,
      clinic: doctor.clinic,
      consultationFee: doctor.consultationFee
    }))

    return NextResponse.json({ doctors: formattedDoctors })

  } catch (error) {
    console.error('Error fetching doctors:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
