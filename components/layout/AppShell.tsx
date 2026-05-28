'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { NavSidebar } from '@/components/layout/NavSidebar'
import { AppTopBar } from '@/components/layout/AppTopBar'
import { ADMIN_NAV_GROUPS } from '@/lib/navigation/admin-navigation'
import { DOCTOR_NAV_FOOTER, DOCTOR_NAV_GROUPS } from '@/lib/navigation/doctor-navigation'
import { PATIENT_NAV_ACCOUNT, PATIENT_NAV_GROUPS } from '@/lib/navigation/patient-navigation'
import {
  isAdminPath,
  isAuthFreePath,
  isDoctorPath,
} from '@/lib/navigation/shell-routes'
import { Stethoscope } from 'lucide-react'
import type { NavItem } from '@/lib/navigation/patient-navigation'

type ShellMode = 'marketing' | 'patient' | 'doctor' | 'admin'

function resolveShellMode(pathname: string, role?: string): ShellMode {
  if (isAuthFreePath(pathname)) return 'marketing'
  if (pathname === '/') return 'marketing'
  if (role === 'DOCTOR' && isDoctorPath(pathname)) return 'doctor'
  if (role === 'ADMIN' && isAdminPath(pathname)) return 'admin'
  return 'patient'
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const shellMode = useMemo(
    () => resolveShellMode(pathname, user?.role),
    [pathname, user?.role]
  )

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isLoading || !user) return
    if (user.role === 'DOCTOR' && pathname === '/') {
      router.replace('/doctor')
      return
    }
    if (user.role !== 'DOCTOR' && pathname === '/') {
      router.replace('/dashboard')
    }
  }, [isLoading, user, pathname, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  if (!user || shellMode === 'marketing') {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  const patientFooter: NavItem[] = [...PATIENT_NAV_ACCOUNT]
  let groups = PATIENT_NAV_GROUPS
  let footerItems = patientFooter
  let portalLabel: string | undefined
  let portalHref: string | undefined

  if (shellMode === 'doctor') {
    groups = DOCTOR_NAV_GROUPS
    footerItems = DOCTOR_NAV_FOOTER
    portalLabel = 'Кабинет пациента'
    portalHref = '/dashboard'
  } else if (shellMode === 'admin') {
    groups = ADMIN_NAV_GROUPS
    footerItems = []
    portalLabel = 'Кабинет пациента'
    portalHref = '/dashboard'
  } else {
    if (user.role === 'DOCTOR') {
      footerItems = [
        { href: '/doctor', label: 'Кабинет врача', icon: Stethoscope },
        ...patientFooter,
      ]
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <NavSidebar
        groups={groups}
        footerItems={footerItems}
        portalLabel={portalLabel}
        portalHref={portalHref}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar
          onMenuClick={() => setMobileNavOpen(true)}
          showAdminLink={user.role === 'ADMIN'}
        />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
