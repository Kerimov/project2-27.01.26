'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AIChat } from '@/components/AIChat'

const HIDDEN_PATHS = new Set(['/login', '/register'])

export function GlobalAIChat() {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()

  if (isLoading || !user) return null
  if (HIDDEN_PATHS.has(pathname)) return null

  return <AIChat />
}
