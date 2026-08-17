'use client'

import { useActionState, useState } from 'react'
import { Check, Loader2, NotebookPen } from 'lucide-react'
import type { LeadStatus } from '@/lib/db/schema'
import { saveLeadNoteAction, updateLeadStatusAction, type LeadStatusState } from '../actions'

const INITIAL: LeadStatusState = { status: 'idle' }

const NEXT_STATUS: { value: LeadStatus; label: string }[] = [
  { value: 'pending', label: 'Belum dihubungi' },
  { value: 'contacted', label: 'Sudah dihubungi' },
  { value: 'negotiation', label: 'Negosiasi' },
  { value: 'won', label: 'Deal' },
  { value: 'lost', label: 'Batal' },
]

/**
 * Pipeline control for one lead.
 *
 * Five buttons rather than a dropdown: on a phone a `<select>` costs two taps and
 * hides the current value behind the second one, and this is the control a sales
 * user touches most often in the app. The active state is visible without
 * opening anything.
 *
 * Each button is its own form submission — no client state to fall out of sync
 * with the row, and it still works if the action is slow enough that the user
 * taps twice.
 */
export function LeadStatusControl({
  leadId,
  current,
}: {
  leadId: string
  current: LeadStatus
}) {
  const [state, action, pending] = useActionState(updateLeadStatusAction, INITIAL)

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="leadId" value={leadId} />

      {NEXT_STATUS.map((option) => {
        const active = option.value === current
        return (
          <button
            key={option.value}
            type="submit"
            name="status"
            value={option.value}
            disabled={pending || active}
            aria-current={active ? 'true' : undefined}
            className={`inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors duration-200 disabled:cursor-default ${
              active
                ? 'border-foreground bg-foreground text-on-accent'
                : 'border-border text-foreground-muted hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {active && <Check width={12} height={12} aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}

      {pending && (
        <Loader2
          width={14}
          height={14}
          className="animate-spin text-foreground-muted"
          aria-label="Menyimpan"
        />
      )}
      {state.status === 'error' && state.message && (
        <span role="alert" className="text-xs font-medium text-primary">
          {state.message}
        </span>
      )}
    </form>
  )
}

/**
 * Private note on a lead.
 *
 * Collapsed by default. An always-open textarea on every card turns the CRM into
 * a wall of empty boxes, and the note is written once per lead at most.
 */
export function LeadNote({ leadId, note }: { leadId: string; note: string | null }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(saveLeadNoteAction, INITIAL)

  if (!open && !note) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-xs font-semibold text-foreground-muted transition-colors duration-200 hover:text-foreground"
      >
        <NotebookPen width={13} height={13} aria-hidden="true" />
        Tambah catatan
      </button>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-md bg-muted px-3 py-2 text-left text-xs leading-relaxed text-foreground transition-colors duration-200 hover:bg-border/40"
      >
        <span className="font-semibold text-foreground-muted">Catatan Anda: </span>
        {note}
      </button>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <textarea
        name="note"
        rows={3}
        defaultValue={note ?? ''}
        maxLength={1000}
        placeholder="Sudah ditelepon, minta dihubungi lagi Sabtu. Tukar tambah Avanza 2019."
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors duration-200 placeholder:text-foreground-muted focus:border-primary"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-4 text-xs font-semibold text-on-accent transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
        >
          {pending && <Loader2 width={12} height={12} className="animate-spin" aria-hidden="true" />}
          Simpan
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-9 cursor-pointer px-2 text-xs font-medium text-foreground-muted transition-colors duration-200 hover:text-foreground"
        >
          Tutup
        </button>
        {state.status === 'success' && (
          <span className="text-xs font-medium text-foreground-muted">Tersimpan</span>
        )}
      </div>
    </form>
  )
}
