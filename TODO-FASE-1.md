# TODO — Fase 1: Perbaikan blocker (1–2 hari)

> **WAJIB sebelum menambah fitur apa pun.** Tiga pertama membuat aplikasi tidak bisa dipakai; sisanya salah tagih atau salah tampil.

---

## 🔴 CRITICAL — Routing dashboard 404 total

**Masalah:** `proxy.ts:118` menambahkan prefix area (`/sales`, `/admin`) tanpa syarat, padahal semua href di `nav.ts:67-73` sudah memuat prefix. Hasilnya URL jadi `/sales/sales/leads` → 404.

**Pilihan fix:**
- **(a) Hapus prefix dari semua href** — href jadi tanpa prefix, proxy yang menambahkan
- **(b) Proxy cek dulu** — hanya tambah prefix kalau pathname belum diawali prefix

**Rekomendasi: (a)** — href tanpa prefix konsisten dengan URL yang dilihat user.

### Checklist opsi (a) — hapus prefix dari href

- [x] **`lib/config/nav.ts:67-73`** — hapus `/sales` dari semua href
  ```diff
  - { href: '/sales', label: 'Home', ... }
  - { href: '/sales/leads', label: 'Leads', ... }
  - { href: '/sales/crm', label: 'CRM', ... }
  - { href: '/sales/topup', label: 'Token', ... }
  - { href: '/sales/referral', label: 'Referral', ... }
  + { href: '/', label: 'Home', exact: true, ... }
  + { href: '/leads', label: 'Leads', ... }
  + { href: '/crm', label: 'CRM', ... }
  + { href: '/topup', label: 'Token', ... }
  + { href: '/referral', label: 'Referral', ... }
  ```

- [x] **`app/(admin)/admin/layout.tsx:21-26`** — hapus `/admin` dari semua href
  ```diff
  - { href: '/admin', label: 'Ringkasan' },
  - { href: '/admin/users', label: 'Users' },
  - { href: '/admin/leads', label: 'Leads' },
  - { href: '/admin/credits', label: 'Kredit' },
  - { href: '/admin/pricing', label: 'Rule Harga' },
  - { href: '/admin/analytics', label: 'Analytics' },
  + { href: '/', label: 'Ringkasan' },
  + { href: '/users', label: 'Users' },
  + { href: '/leads', label: 'Leads' },
  + { href: '/credits', label: 'Kredit' },
  + { href: '/pricing', label: 'Rule Harga' },
  + { href: '/analytics', label: 'Analytics' },
  ```

- [x] **`app/(admin)/admin/layout.tsx:33`** — logo link
  ```diff
  - <Link href="/admin" ...>
  + <Link href="/" ...>
  ```

- [x] **`app/login/actions.ts:173-174`** — `defaultLanding()`
  ```diff
  - if (area === 'sales') return '/sales'
  - if (area === 'admin') return '/admin'
  + if (area === 'sales') return '/'
  + if (area === 'admin') return '/'
  ```

- [x] **`app/(sales)/sales/actions.ts:47-49, 113-114, 134`** — `revalidatePath` **JANGAN DIUBAH**
  > `revalidatePath()` menerima path **internal** (route file setelah route group dibuang),
  > bukan URL yang dilihat user. Route-nya memang `/sales/leads`. Rewrite proxy tidak
  > mengubah ini. Nilai sekarang sudah benar.

- [x] **`app/(sales)/sales/topup/page.tsx:168`**
  ```diff
  - <Link href="/sales/referral" ...>
  + <Link href="/referral" ...>
  ```

- [x] **`app/(sales)/sales/referral/page.tsx:140`**
  ```diff
  - href="/sales/topup"
  + href="/topup"
  ```

- [x] **`app/(sales)/sales/page.tsx` (7 tempat)** — baris 69, 144, 164, 205, 212, 219, 230
  ```diff
  - href="/sales/crm?status=pending"
  - href="/sales/leads"
  - href="/sales/topup"
  - href="/sales/crm?status=negotiation"
  - href="/sales/crm?status=won"
  - href="/sales/referral"
  + href="/crm?status=pending"
  + href="/leads"
  + href="/topup"
  + href="/crm?status=negotiation"
  + href="/crm?status=won"
  + href="/referral"
  ```

- [x] **`app/(sales)/sales/leads/unlock-button.tsx:39, 77`**
  ```diff
  - href="/sales/topup"
  - <a href="/sales/crm" ...>
  + href="/topup"
  + <a href="/crm" ...>
  ```

- [x] **`app/(sales)/sales/leads/page.tsx` (3 tempat)** — baris 101, 144, 150
  ```diff
  - <Link href="/sales/topup" ...>
  - href="/sales/leads"
  - href="/sales/referral"
  + <Link href="/topup" ...>
  + href="/leads"
  + href="/referral"
  ```

- [x] **`app/(sales)/sales/layout.tsx:36, 52`**
  ```diff
  - href="/sales"
  - href="/sales/topup"
  + href="/"
  + href="/topup"
  ```

- [x] **`app/(sales)/sales/crm/page.tsx:94, 119`**
  ```diff
  - href={tab.value === 'all' ? '/sales/crm' : `/sales/crm?status=${tab.value}`}
  - href="/sales/leads"
  + href={tab.value === 'all' ? '/crm' : `/crm?status=${tab.value}`}
  + href="/leads"
  ```

### Verifikasi

- [ ] Dev: `npm run dev`, buka `sales.localhost:3000`, klik kelima menu → semua harus load
- [ ] Dev: buka `admin.localhost:3000`, klik kelima menu → semua harus load
- [x] Build: `npm run build` sukses tanpa error routing (juga `tsc --noEmit` dan `eslint` bersih)

---

## 🔴 HIGH — Harga unlock beda antara tampilan dan tagihan

**Masalah:** `lib/sales/queries.ts:208` memanggil `unlockPrices()` tanpa parameter brand, jadi menampilkan harga generik. Tapi `lib/sales/unlock.ts` menagih harga brand-specific. Sales lihat "10 token", klik unlock, saldo terpotong 15 token.

- [x] **`lib/sales/queries.ts` baris ~195-220** — marketplace query
  - Opsi 1: join `unlock_pricing_rules` dengan brand + tier di query utama, hitung harga per baris
  - Opsi 2: panggil `priceFor(tx, tier, brand)` per baris hasil (butuh loop, lebih lambat)
  - **Rekomendasi: Opsi 1** — satu query, tidak ada loop

- [x] **`app/(sales)/sales/leads/unlock-button.tsx:34`** — `short = balance < tokenCost`
  - Sekarang bisa salah: tombol aktif padahal saldo tidak cukup untuk harga brand asli
  - Setelah harga benar, logic ini otomatis benar

### Verifikasi

- [ ] Seed `unlock_pricing_rules` dengan harga berbeda per brand (mis. Toyota 5, Mercy 20)
- [ ] Buka marketplace, cek harga di kartu lead cocok dengan rule
- [ ] Unlock lead → cek `token_ledger.delta` cocok dengan harga yang ditampilkan

---

## 🔴 HIGH — OTP terkirim tapi tidak pernah bisa diverifikasi

**Masalah:** `lib/whatsapp/client.ts:122` — `looksRejected()` cocokkan substring `error`/`invalid` ke seluruh body. Response sukses dengan `"error":null` dianggap gagal → `persist()` tidak pernah dipanggil → OTP tidak masuk Redis → verifikasi selalu fail.

- [x] **Pilih provider WhatsApp gateway dulu** — kontrak response menentukan logic fix
  - Kandidat: Fonnte, Wablas, WA Business API, atau gateway custom
  - Tulis kontrak sukses ke `lib/whatsapp/contract.ts` (field mana yang menandai sukses)

- [x] **`lib/whatsapp/client.ts:122-134`** — ganti `looksRejected()` ke pengecekan field eksplisit
  - Sampai provider final: fallback aman = anggap sukses kalau HTTP 2xx dan tidak ada field error yang dikenali
  - Contoh untuk Fonnte: `!body.status || body.status === 'success'`
  - Contoh untuk WA Business: `body.messages?.[0].id` ada

### Verifikasi

- [ ] Kirim OTP → cek Redis `otp:code:{phone}` ada
- [ ] Input kode benar → berhasil login
- [ ] Input kode salah 5× → coba counter habis
- [ ] Kode sudah kedaluwarsa (>5 menit) → rejected

---

## 🟡 MEDIUM — Sisanya

### 1. Note save tidak cek baris terupdate

- [x] **`app/(sales)/sales/actions.ts:129-135`** — `saveLeadNoteAction`
  - Tambahkan `.returning()` seperti `updateLeadStatusAction:107-111`
  - Return error kalau `result.length === 0` (lead milik sales lain)

### 2. Batas bulan salah zona waktu

- [x] **`lib/sales/queries.ts:331-333`** — `referralSummary` pakai UTC
  - Ganti ke `lib/utils/date.ts` helper untuk Asia/Jakarta
  - Atau inline: `new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0,7)` → `'2026-08'`

### 3. Matcher proxy bypass wrong-host block

- [x] **`proxy.ts:133`** — `.*\..*` mengeluarkan path bertitik dari proxy
  - Jangkarkan klausa ekstensi: `.*\.(ico|png|jpg|svg|webp|woff2?|ttf)$`
  - Atau whitelist: `(favicon\.ico|sitemap\.xml|robots\.txt)`

### 4. Resend OTP lost state

- [x] **`app/login/login-form.tsx:28, 97`**
  - Pisahkan state `resendCooldown` dari `cooldown` kirim awal
  - Resend gagal jangan lempar user balik ke input nomor

### 5. `serverEnv()` tidak pernah dipanggil

- [x] **`lib/env.ts:30`** — panggil di top-level:
  - `lib/db/index.ts`
  - `lib/auth/session.ts`
  - `lib/auth/otp.ts`
  - `lib/whatsapp/client.ts`

### 6. TLS verification disabled

- [x] **`lib/db/index.ts:41`** — `rejectUnauthorized: false`
  - Pin CA Supabase atau hapus opsi ini (default `true`)

### 7. `attemptsLeft` off by one — TEMUAN SALAH, JANGAN DIUBAH

- [x] **`lib/auth/otp.ts:150`** — kode aslinya sudah benar, diverifikasi ulang
  - `MAX_VERIFY_ATTEMPTS = 5`, guard-nya `if (attempts > MAX_VERIFY_ATTEMPTS)`, dan
    `attempts` sudah termasuk percobaan yang sedang berjalan.
  - Cek dua ujung: `attempts=1` → sisa percobaan 2,3,4,5 = 4 = `5-1` ✓;
    `attempts=5` → percobaan ke-6 ditolak guard = 0 sisa = `5-5` ✓.
  - Perubahan `- attempts - 1` justru **membuat bug baru** (undercount 1). Sudah
    di-revert; komentar verifikasi ditambahkan di kode supaya tidak "diperbaiki" lagi.

### 8. Timeframe slug mentah di UI

- [x] **`app/(customer)/request/page.tsx:190`**
  - Pakai fungsi `timeframeLabel(slug)` dari validation, bukan slug mentah

### 9. "N request aktif" salah hitung

- [x] **`app/(customer)/request/page.tsx:78`**
  - Filter status: `status NOT IN ('closed', 'expired')`

### 10. Root sales/admin tidak kena `noindex`

- [x] **`next.config.ts:47`** — redirect `/(sales|admin)/:path*`
  - Tambahkan `'/(sales|admin)'` (tanpa `:path*`) supaya root ikut

---

## Urutan kerjakan

1. **CRITICAL dulu** — routing + harga + OTP (estimasi 4–6 jam)
2. **MEDIUM paralel** — 10 item kecil bisa dikerjakan bersamaan atau incremental (2–3 jam)
3. **Verifikasi end-to-end:**
   - Customer: request mobil → sales lihat di marketplace
   - Sales: unlock → balance terpotong benar → CRM bisa buka lead
   - Admin: lihat transaksi di ledger

---

## Dependency Fase 1 → Fase 2

Fase 2 (migration) baru bisa mulai setelah Fase 1 selesai, karena:
- Migration akan mengubah enum `lead_status` (tambah `contacted`)
- Migration akan tambah kolom `requests.target_price`
- Tidak ada gunanya migrasi kalau aplikasi belum jalan

Fase 1 **tidak butuh keputusan Bagian 0** — semua fix di sini cuma perbaiki bug kode yang sudah ada.
