import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Этот тестовый маршрут использует базу данных, поэтому помечаем его как динамический,
// чтобы Next.js не пытался выполнять его на этапе статического экспорта.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Простой тест подключения к базе данных
    const userCount = await prisma.user.count()
    
    return NextResponse.json({
      message: 'Database connection successful',
      userCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      { 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
