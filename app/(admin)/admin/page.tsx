export const metadata = { title: 'Ringkasan' }

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Ringkasan</h1>

      <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-foreground-muted">
        Belum ada data. Metrik terisi setelah migration dijalankan dan tabel terisi.
      </p>
    </div>
  )
}
