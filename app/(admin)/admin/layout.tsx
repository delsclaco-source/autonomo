import Link from 'next/link'
import { requirePageUser } from '@/lib/auth/guard'

/**
 * Admin shell at admin.autonomo.id.
 *
 * Deliberately plainer than the sales UI: this is an internal tool where
 * density and scanability matter more than polish.
 *
 * The role check here is the real one — the proxy only saw a cookie. Admin is
 * the highest-privilege area, so nothing below renders until the session
 * resolves to an admin row in the database.
 */
// Same reasoning as the sales shell: per-user data, no build-time prerender.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requirePageUser('admin')

  const nav = [
    { href: '/', label: 'Ringkasan' },
    { href: '/users', label: 'Users' },
    { href: '/leads', label: 'Leads' },
    { href: '/credits', label: 'Kredit' },
    { href: '/pricing', label: 'Rule Harga' },
    { href: '/analytics', label: 'Analytics' },
  ]

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center px-4">
          <Link href="/" className="font-heading font-semibold text-primary">
            Autonomo<span className="text-destructive">.id</span>
            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-foreground-muted">
              Admin
            </span>
          </Link>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-foreground-muted transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
