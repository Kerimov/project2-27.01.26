import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { GlobalAIChat } from '@/components/GlobalAIChat'
import { WebThemeBootstrap } from '@/components/WebThemeBootstrap'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'ПМА - Персональный Медицинский Ассистент',
  description: 'Персональный Медицинский Ассистент для управления здоровьем, напоминаний о приеме лекарств и записи к врачам',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <Script
          id="pma-web-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pma-web-theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`,
          }}
        />
        <WebThemeBootstrap />
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <GlobalAIChat />
        </AuthProvider>
      </body>
    </html>
  )
}

