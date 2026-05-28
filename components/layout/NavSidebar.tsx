'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { isNavItemActive } from '@/lib/navigation/shell-routes'
import type { NavGroup, NavItem } from '@/lib/navigation/patient-navigation'
import { Logo } from '@/components/Logo'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type NavSidebarProps = {
  groups: NavGroup[]
  footerItems?: NavItem[]
  portalLabel?: string
  portalHref?: string
  mobileOpen: boolean
  onMobileClose: () => void
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const active = isNavItemActive(pathname, item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.description}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : '')} />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

export function NavSidebar({
  groups,
  footerItems = [],
  portalLabel,
  portalHref,
  mobileOpen,
  onMobileClose,
}: NavSidebarProps) {
  const pathname = usePathname()

  const panel = (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href={groups[0]?.items[0]?.href || '/'} className="flex items-center gap-2 min-w-0" onClick={onMobileClose}>
          <Logo size="sm" showText={false} />
          <span className="truncate text-sm font-bold text-gradient-brand">ПМА</span>
        </Link>
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onMobileClose} aria-label="Закрыть меню">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onMobileClose} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-4 space-y-0.5">
        {portalHref && portalLabel && (
          <Link
            href={portalHref}
            onClick={onMobileClose}
            className="mb-2 flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
          >
            {portalLabel}
          </Link>
        )}
        {footerItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onMobileClose} />
        ))}
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">{panel}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть меню"
            onClick={onMobileClose}
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">{panel}</div>
        </div>
      )}
    </>
  )
}
