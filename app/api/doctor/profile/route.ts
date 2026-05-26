import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Использует headers/cookies, помечаем маршрут как динамический
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Проверяем токен: сначала из заголовка, затем из cookie
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
    if (!token) {
      const cookieToken = request.cookies.get('token')?.value
      if (cookieToken) token = cookieToken
    }
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    // Проверяем, что пользователь является врачом
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 404 })
    }

    return NextResponse.json(doctorProfile)

  } catch (error) {
    console.error('Error fetching doctor profile:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении профиля врача' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем токен: сначала из заголовка, затем из cookie
    const authHeader = request.headers.get('authorization')
    let token: string | undefined
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
    if (!token) {
      const cookieToken = request.cookies.get('token')?.value
      if (cookieToken) token = cookieToken
    }
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })
    }

    const body = await request.json()
    const {
      licenseNumber,
      specialization,
      experience,
      education,
      certifications,
      phone,
      clinic,
      address,
      consultationFee,
      workingHours
    } = body

    // Проверяем, что профиль врача еще не создан
    const existingProfile = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId }
    })

    if (existingProfile) {
      return NextResponse.json({ error: 'Профиль врача уже существует' }, { status: 400 })
    }

    // Проверяем уникальность номера лицензии
    const existingLicense = await prisma.doctorProfile.findUnique({
      where: { licenseNumber }
    })

    if (existingLicense) {
      return NextResponse.json({ error: 'Врач с таким номером лицензии уже зарегистрирован' }, { status: 400 })
    }

    // Создаем профиль врача
    const doctorProfile = await prisma.doctorProfile.create({
      data: {
        userId: decoded.userId,
        licenseNumber,
        specialization,
        experience,
        education,
        certifications: certifications || null,
        phone: phone || null,
        clinic: clinic || null,
        address: address || null,
        consultationFee: consultationFee || null,
        workingHours: workingHours ? JSON.stringify(workingHours) : undefined,
        isVerified: false,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(doctorProfile, { status: 201 })

  } catch (error) {
    console.error('Error creating doctor profile:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании профиля врача' },
      { status: 500 }
    )
  }
}
