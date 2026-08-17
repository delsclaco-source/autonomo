import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requirePageUser } from '@/lib/auth/guard'
import { OfferForm } from '../offer-form'

export const metadata: Metadata = { title: 'Tambah penawaran' }

// The form posts to a Server Action and the page reads the session; nothing here
// can be prerendered.
export const dynamic = 'force-dynamic'

/**
 * New offer page.
 *
 * The guard runs here as well as in the layout above. A page is reachable by URL
 * and its Server Action by POST without either rendering, so each entry point
 * asserts the session for itself.
 */
export default async function NewOfferPage() {
  await requirePageUser('sales')

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link
          href="/offers"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
        >
          <ArrowLeft width={15} height={15} aria-hidden="true" />
          Penawaran saya
        </Link>

        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Tambah penawaran
        </h1>
        <p className="mt-1 max-w-xl text-sm text-foreground-muted">
          Satu penawaran untuk satu model. Customer yang request model ini akan melihat diskon
          maksimal Anda — angka itu yang menentukan siapa yang dihubungi lebih dulu.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <OfferForm />
      </div>
    </div>
  )
}
