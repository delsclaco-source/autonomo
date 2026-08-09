import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { areaFromHost } from '@/lib/config/subdomains'
import { getSessionUser } from '@/lib/auth/session'
import { safeNextPath } from '@/lib/auth/redirect'
import { LoginForm } from './login-form'

export const metadata = { title: 'Masuk' }

// Reads cookies and hits the database to decide whether to bounce a signed-in
// visitor straight through; nothing here can be prerendered.
export const dynamic = 'force-dynamic'

/**
 * The OTP Server Action calls an external WhatsApp gateway that retries once on
 * timeout, so this route needs headroom beyond the default 10s function budget.
 * The client is bounded by the gateway module's own deadlines well inside this.
 */
export const maxDuration = 30

/**
 * Login entry point.
 *
 * One route serves all three areas. The proxy does not rewrite `/login`, so the
 * host header still identifies which dashboard the visitor is trying to reach —
 * that determines which role the resulting session is minted for.
 *
 * There is no separate signup: an unknown WhatsApp number is registered on its
 * first successful OTP. A phone number the buyer has to prove they control is the
 * only credential the product needs, and a second "daftar" form asking for the
 * same number would be a step with nothing behind it.
 *
 * `?next=` carries where the visitor was going — the request form, usually, with
 * their car and target price already in the query. It is re-validated here with
 * the same allowlist the proxy uses, because this copy of the value came from the
 * URL bar and nothing else vouches for it.
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const area = areaFromHost((await headers()).get('host'))
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null)

  // Already signed in: skip the form entirely rather than making them log in
  // twice to get back to a page they can already see.
  const user = await getSessionUser(area)
  if (user) redirect(next ?? '/')

  const copy = {
    customer: {
      title: next ? 'Verifikasi nomor Anda' : 'Masuk ke Autonomo.id',
      body: next
        ? 'Request Anda tersimpan. Masukkan nomor WhatsApp untuk mengirimnya ke sales dealer.'
        : 'Masukkan nomor WhatsApp Anda. Kami kirim kode verifikasi.',
    },
    sales: {
      title: 'Masuk sebagai Sales',
      body: 'Gunakan nomor WhatsApp yang terdaftar di dealer Anda.',
    },
    admin: {
      title: 'Masuk sebagai Admin',
      body: 'Akses internal. Nomor harus terdaftar sebagai admin.',
    },
  }[area]

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 self-start text-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
      >
        <ArrowLeft width={15} height={15} aria-hidden="true" />
        Kembali
      </Link>

      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">{copy.body}</p>

        <LoginForm next={next} />
      </div>
    </div>
  )
}
