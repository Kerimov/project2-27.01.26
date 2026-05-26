import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { parse as parseCookies } from 'cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7)
  const cookieHeader = request.headers.get('cookie')
  const cookies = cookieHeader ? parseCookies(cookieHeader) : {}
  return cookies.token || null
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      select: { id: true }
    })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const records = await prisma.patientRecord.findMany({
      where: { doctorId: doctor.id },
      select: { id: true, patientId: true, patient: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const recordIds = records.map((r) => r.id)
    if (recordIds.length === 0) return NextResponse.json({ prescriptions: [] })

    const pres = await prisma.prescription.findMany({
      where: { patientRecordId: { in: recordIds } },
      orderBy: { prescribedAt: 'desc' }
    })

    const patientByRecordId = new Map(records.map((r) => [r.id, r.patient]))

    const result = pres.map((p) => ({
      ...p,
      patient: patientByRecordId.get(p.patientRecordId) || null
    }))

    return NextResponse.json({ prescriptions: result })
  } catch (e) {
    console.error('Error fetching doctor prescriptions:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded?.userId) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: decoded.userId },
      select: { id: true }
    })
    if (!doctor) return NextResponse.json({ error: 'Профиль врача не найден' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const patientId = typeof body?.patientId === 'string' ? body.patientId.trim() : ''
    const medication = typeof body?.medication === 'string' ? body.medication.trim() : ''
    const dosage = typeof body?.dosage === 'string' ? body.dosage.trim() : ''
    const frequency = typeof body?.frequency === 'string' ? body.frequency.trim() : ''
    const duration = typeof body?.duration === 'string' ? body.duration.trim() : ''
    const instructions = typeof body?.instructions === 'string' && body.instructions.trim() ? body.instructions.trim() : null
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null

    if (!patientId) return NextResponse.json({ error: 'patientId обязателен' }, { status: 400 })
    if (!medication) return NextResponse.json({ error: 'medication обязателен' }, { status: 400 })
    if (!dosage) return NextResponse.json({ error: 'dosage обязателен' }, { status: 400 })
    if (!frequency) return NextResponse.json({ error: 'frequency обязателен' }, { status: 400 })
    if (!duration) return NextResponse.json({ error: 'duration обязателен' }, { status: 400 })

    // Проверяем, что врач связан с пациентом (карточка или приём)
    const [rec, appt] = await Promise.all([
      prisma.patientRecord.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { doctorId: doctor.id, patientId }, select: { id: true } })
    ])
    if (!rec && !appt) return NextResponse.json({ error: 'Нет доступа к пациенту' }, { status: 403 })

    // Берём последний record или создаём новый recordType="prescription"
    const record = rec
      ? await prisma.patientRecord.findFirst({
          where: { doctorId: doctor.id, patientId },
          orderBy: { createdAt: 'desc' },
          select: { id: true }
        })
      : await prisma.patientRecord.create({
          data: {
            doctorId: doctor.id,
            patientId,
            recordType: 'prescription',
            status: 'active'
          },
          select: { id: true }
        })

    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.prescription.create({
        data: {
          doctorId: doctor.id,
          patientRecordId: record.id,
          medication,
          dosage,
          frequency,
          duration,
          instructions,
          isActive: true,
          expiresAt
        }
      })

      // Авто-напоминание пациенту: после назначения
      const pref = await tx.reminderPreference.findUnique({ where: { userId: patientId }, select: { email: true, push: true, sms: true } })
      const channels = [pref?.email ? 'EMAIL' : null, pref?.push ? 'PUSH' : null, pref?.sms ? 'SMS' : null].filter(Boolean)
      const dueAt = new Date(Date.now() + 60 * 60 * 1000) // через 1 час
      await tx.reminder.create({
        data: {
          userId: patientId,
          title: `Назначение: ${medication}`,
          description: `Врач назначил препарат.\n${dosage} • ${frequency} • ${duration}${instructions ? `\nИнструкция: ${instructions}` : ''}`,
          dueAt,
          recurrence: 'NONE',
          channels: channels.length ? channels : ['PUSH']
        }
      })

      return p
    })

    return NextResponse.json({ prescription: created }, { status: 201 })
  } catch (e) {
    console.error('Error creating doctor prescription:', e)
    return NextResponse.json({ error: 'Ошибка при создании рецепта' }, { status: 500 })
  }
}


