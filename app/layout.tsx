import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

// Headings. Plus Jakarta Sans over the other two the brief allows because its
// wider apertures hold up at the tight tracking headlines use here, and it was
// cut for Indonesian text — the market this ships to.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})

// Body. Inter's tabular figures are what keep price and discount columns
// aligned; see the `.tabular` helper in globals.css.
const inter = Inter({
  variable: '--font-inter',
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
    // --font-sans directly, which shadowed the pairing globals.css builds.
    <html lang="id" className={`h-full antialiased ${jakarta.variable} ${inter.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
