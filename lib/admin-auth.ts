import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function getAdminFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cookieToken = request.cookies.get('token')?.value
  const raw = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken
  if (!raw) return null

  const decoded = verifyToken(raw)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, name: true, role: true },
  })

  if (!user || user.role !== 'ADMIN') return null
  return { token: raw, user }
}
