'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'

/**
 * Referral code with copy and native share.
 *
 * The link is built on the client from `location.origin` rather than passed down
 * from the server, so it is correct on localhost, on a Vercel preview URL, and in
 * production without a build-time constant that can go stale.
 *
 * `navigator.share` is used when available — on a phone that is the difference
 * between one tap and copy-then-switch-app-then-paste — and falls back to copy
 * everywhere else.
 */
export function ReferralShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const link = () =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/login?ref=${code}`

  const message = () =>
    `Daftar jadi sales di Autonomo.id pakai kode ${code} — kita berdua dapat bonus token. ${link()}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(message())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers.
      // The code is displayed in full above, so a failure here is recoverable by
      // reading it — no error state worth interrupting the user with.
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Autonomo.id', text: message() })
        return
      } catch {
        // User dismissed the sheet, or the browser refused. Fall through to copy.
      }
    }
    void copy()
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted sm:flex-none"
      >
        {copied ? (
          <Check width={15} height={15} className="text-foreground" aria-hidden="true" />
        ) : (
          <Copy width={15} height={15} aria-hidden="true" />
        )}
        {copied ? 'Tersalin' : 'Salin ajakan'}
      </button>

      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover sm:flex-none"
      >
        <Share2 width={15} height={15} aria-hidden="true" />
        Bagikan
      </button>
    </div>
  )
}
