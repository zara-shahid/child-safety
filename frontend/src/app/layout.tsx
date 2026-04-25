import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider, ErrorBoundary } from '@/components/ui'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'EPCID | Early Pediatric Critical Illness Detection',
  description: 'AI-powered pediatric health monitoring and early illness detection for caregivers',
  keywords: ['pediatric', 'health', 'AI', 'illness detection', 'children', 'monitoring'],
  authors: [{ name: 'Ayesha-Ali676' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-512x512.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EPCID',
  },
  openGraph: {
    title: 'EPCID | Early Pediatric Critical Illness Detection',
    description: 'AI-powered pediatric health monitoring for caregivers',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'light';
                if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased text-surface-900 dark:text-white transition-colors duration-300" suppressHydrationWarning>
        {/* Unified App Background */}
        <div className="app-background">
          <div className="gradient-orb gradient-orb-1" />
          <div className="gradient-orb gradient-orb-2" />
          <div className="gradient-orb gradient-orb-3" />
        </div>
        <ThemeProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
