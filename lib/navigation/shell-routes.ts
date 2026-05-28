export const AUTH_FREE_PATHS = new Set(['/login', '/register'])

export function isAuthFreePath(pathname: string): boolean {
  return AUTH_FREE_PATHS.has(pathname)
}

export function isDoctorPath(pathname: string): boolean {
  return pathname === '/doctor' || pathname.startsWith('/doctor/')
}

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/doctor') return pathname === '/doctor'
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}
