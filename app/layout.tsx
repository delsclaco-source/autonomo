import type { Metadata, Viewport } from 'next'
import { Lexend, Source_Sans_3 } from 'next/font/google'
import './globals.css'

const lexend = Lexend({
  variable: '--font-lexend',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Autonomo.id',
    template: '%s · Autonomo.id',
  },
  description:
    'Marketplace lead generation otomotif: bandingkan penawaran diskon mobil baru dari sales resmi dealer tanpa datang ke showroom.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is never disabled — pinch-to-zoom is an accessibility requirement.
  maximumScale: 5,
  // Light-only product decision: native controls, form widgets, and scrollbars
  // must not be repainted dark on a dark-OS device.
  colorScheme: 'light',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // Geist was pulled in by `shadcn init` and removed again: it bound
    // --font-sans, which shadowed the Source Sans 3 / Lexend pairing that
    // MASTER.md specifies.
    <html lang="id" className={`h-full antialiased ${lexend.variable} ${sourceSans.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
