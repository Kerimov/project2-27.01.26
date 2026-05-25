export type WebThemeScheme = 'light' | 'dark'

const STORAGE_KEY = 'pma-web-theme'

export function getWebTheme(): WebThemeScheme {
  if (typeof window === 'undefined') return 'light'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* ignore */
  }
  return 'light'
}

export function setWebTheme(scheme: WebThemeScheme) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, scheme)
    applyThemeToDocument(scheme)
  } catch {
    /* ignore */
  }
}

export function applyThemeToDocument(scheme: WebThemeScheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (scheme === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
}
