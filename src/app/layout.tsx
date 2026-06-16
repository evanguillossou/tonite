import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Tonite — Paris Nightlife',
  description: 'Découvre les meilleurs spots nightlife à Paris selon ton mood.',
  manifest: '/manifest.json',
  // Favicon & apple-touch-icon gérés par la convention App Router :
  // src/app/icon.png et src/app/apple-icon.png (générés depuis le logo).
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tonite',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="antialiased font-body">
        {children}
      </body>
    </html>
  )
}
