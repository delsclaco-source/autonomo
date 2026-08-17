# CLAUDE.md — Autonomo.id

Panduan ini dibaca otomatis oleh Claude Code setiap sesi dimulai di repo ini. Isinya adalah konteks produk, tech stack, dan konvensi kerja untuk project Autonomo.id.

## 1. Tentang Produk

**Autonomo.id** adalah marketplace digital lead generation otomotif di Indonesia yang menjembatani calon pembeli mobil baru (customer) dengan sales resmi dealer.

- Customer input request (brand, model, tipe, varian, diskon yang diinginkan) → tanpa perlu datang ke dealer.
- Sales membuka (unlock) data hot lead customer dengan menukarkan **token/credit**, lalu menghubungi via WhatsApp terverifikasi.
- Monetisasi: **freemium (100 token gratis + referral)** dan **premium membership (top-up unlimited, verified badge, CRM penuh)**.
- Model bisnis divalidasi lewat simulasi revenue: ±Rp2,9 M/tahun pada 1.000 sales aktif, berpotensi ±Rp22,5 M/tahun pada skala 5.000 sales.

### Dua peran utama
| Role | Inti kebutuhan |
|---|---|
| **Customer** | Login OTP WA, form request mobil, tracking sales yang ambil request, lihat Top 5/10 diskon |
| **Sales** | Login OTP WA, lead marketplace (hot leads tersembunyi), unlock via token, CRM dashboard, top-up token, referral |
| **Admin** | User management, lead management, credit/transaction management, analytics |

### Fitur inti (urutan MVP → Phase 3)
1. **MVP** — auth OTP WA, form request customer, unlock lead dengan token, freemium (100 token, 3 unlock/hari), admin panel basic.
2. **Phase 2** — premium membership, Bid Credit System aktif, dashboard status transaksi (Pending/Negotiation/Won/Lost).
3. **Phase 3** — Top 5/Top 10 Campaign Diskon (ranking real-time), profil publik sales + review, dealer-sponsored reward.
4. **Phase 4** — mobile app, AI-based lead scoring & analytics lanjutan.

> Detail lengkap requirement, user story, skema token, dan simulasi revenue ada di `docs/PRD-Autonomo.id.docx` (atau versi markdown jika sudah dikonversi) — rujuk ke sana untuk detail angka/copy, jangan menebak.

## 2. Skema Token/Credit (logika bisnis kritis)

Ini logika inti yang **wajib dijaga konsistensinya** di seluruh codebase (backend, DB constraint, frontend display):

- 1 Token = 1 Poin. Dibeli lewat payment gateway (Midtrans/Xendit) dari dashboard sales.
- Biaya unlock dinamis per tier mobil:
  - Low tier (city car): **5–10 token**
  - Mid tier (SUV/MPV): **20–30 token**
  - High tier (luxury/sport): **50–100 token**
- Freemium: 100 token saat registrasi, maksimal **3 unlock/hari**, tidak auto-reload.
- Referral: +30 token per referral sukses, **maksimal 300 token/bulan**.
- Paket top-up: Starter (100/Rp100rb), Basic (250+10/Rp240rb), Pro (500+30/Rp450rb), Premium (1.000+100/Rp850rb), Ultimate (2.000+300/Rp1,6jt).
- Rule engine biaya unlock per kategori mobil harus **configurable oleh admin** — jangan hardcode di frontend.

## 3. Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | **Next.js** (App Router, Server Components/Actions kecuali disebutkan lain) |
| Database | **PostgreSQL** (Supabase, koneksi lewat pooler port 6543) |
| Cache / rate-limit / session | **Redis** |
| Deployment | **Vercel** |
| UI/UX intelligence | Skill **ui-ux-pro-max** (styles, palette, font pairing, komponen) |

### Konvensi kerja dengan stack ini
- Gunakan **Server Actions** Next.js untuk mutasi (unlock lead, top-up token, submit request) — hindari route handler kecuali untuk webhook (payment gateway callback) atau API publik.
- Semua write ke saldo token (unlock, top-up, referral bonus) **wajib pakai transaction/lock di PostgreSQL** (`SELECT ... FOR UPDATE` atau `SERIALIZABLE`) untuk hindari race condition saldo — ini rawan double-spend kalau sales unlock lead bersamaan dari 2 device.
- **Redis** dipakai untuk: rate-limit OTP WhatsApp, cache ranking Top 5/10 diskon (invalidate saat ada submission baru), session/queue untuk webhook payment.
- Ranking Top 5/10 diskon: hitung di query database real-time, cache hasil di Redis dengan TTL pendek (mis. 30–60 detik) supaya tidak query berat tiap page load.
- Deploy ke **Vercel** → hindari long-running background job di serverless function; pakai Vercel Cron atau queue eksternal untuk job seperti reminder follow-up CRM.
- Environment variables (DB URL, Redis URL, payment gateway keys, WhatsApp OTP API key) **tidak pernah** di-hardcode atau di-commit.

## 4. Arsitektur Subdomain (Multi-App dalam 1 Next.js Repo)

Tiga dashboard dipisah lewat subdomain, di-serve dari **satu repo Next.js** (monolith, bukan monorepo terpisah) via `proxy.ts` yang rewrite request berdasarkan hostname:

| Subdomain | Untuk | Folder route group |
|---|---|---|
| `autonomo.id` (root/apex + `www`) | Customer/User | `app/(customer)/...` |
| `sales.autonomo.id` | Sales | `app/(sales)/sales/...` |
| `admin.autonomo.id` | Admin | `app/(admin)/admin/...` |

> **Catatan Next.js 16:** konvensi `middleware.ts` sudah di-deprecate dan diganti nama jadi **`proxy.ts`** (fungsi diekspor sebagai `proxy`, bukan `middleware`). Perilakunya identik. Codemod: `npx @next/codemod@canary middleware-to-proxy .`

### Routing via proxy
- `proxy.ts` baca `request.headers.get("host")`, tentukan area (customer/sales/admin) lewat `lib/config/subdomains.ts`, lalu `NextResponse.rewrite()` ke namespace path internal (mis. `sales.autonomo.id/dashboard` → rewrite ke `/sales/dashboard`) tanpa mengubah URL yang terlihat user.
- **Route group saja tidak cukup** untuk memisahkan ketiga area: tanda kurung dibuang dari URL, jadi `(customer)/page.tsx` dan `(sales)/page.tsx` sama-sama resolve ke `/` dan bentrok saat build. Segmen asli `/sales` dan `/admin` yang membedakan; proxy yang menyembunyikannya dari user.
- Proxy juga menolak akses langsung ke namespace internal dari host yang salah (`autonomo.id/admin/users` → 404), supaya shell admin tidak ter-render ke publik.
- Matcher proxy dikecualikan untuk `_next/*`, file statis, dan `api/webhooks/*` yang memang lintas-subdomain.
- **Cek role di proxy hanya optimistic UX guard** — proxy cuma bisa lihat ada/tidaknya cookie, bukan validitas atau role-nya. Server Action adalah POST ke route halaman, dan perubahan matcher bisa diam-diam menghapus cakupan proxy. Otorisasi asli selalu di `requireUser()` yang baca ulang role dari database.


### Auth & session lintas subdomain

**Keputusan: isolasi per-subdomain, bukan SSO.** Cookie `autonomo_session` di-set **tanpa** atribut `Domain`, jadi host-only — session yang lahir di `sales.autonomo.id` tidak pernah dikirim ke `admin.autonomo.id`. Blast radius kecil kalau satu cookie bocor. Kalau nanti produk butuh satu login untuk tiga peran, baru ganti ke `Domain=.autonomo.id`.

- Cookie hanya berisi **session id acak buram** (32 byte). Tidak ada role, tidak ada user id, tidak ada apa pun yang bisa dimodifikasi klien untuk naik hak akses.
- Role selalu dibaca ulang dari tabel `sessions` + `users` tiap request (`lib/auth/session.ts`). Efeknya: suspend user langsung berlaku di request berikutnya, tidak menunggu token expired.
- Kolom `sessions.area` mencatat subdomain penerbit. Session sales ditolak di area admin walau cookie-nya entah bagaimana sampai ke sana.
- **Role check ganda**: proxy cek area vs cookie (optimistic), `requireUser(area)` cek ulang role dari DB di tiap server action/page. Jangan pernah andalkan subdomain saja sebagai access control.

### Setup domain di Vercel
- Tambahkan tiga domain di Vercel project settings: `autonomo.id`, `www.autonomo.id` (redirect ke apex atau sebaliknya — pilih satu canonical), `sales.autonomo.id`, `admin.autonomo.id` — semua mengarah ke deployment yang sama (satu project).
- DNS: `A`/`ALIAS` record untuk apex ke Vercel, `CNAME` untuk `sales` dan `admin` ke `cname.vercel-dns.com`.
- Kalau perlu environment/config berbeda per subdomain (mis. analytics id, feature flag), baca dari `host` di proxy/layout, jangan bikin deployment Vercel terpisah kecuali admin memang butuh isolasi infra penuh (mis. IP allowlist khusus admin).
- Dev lokal: `sales.localhost:3000` dan `admin.localhost:3000` resolve tanpa ubah file hosts di Chrome dan Firefox.

### Struktur folder (kondisi aktual)
```
app/
  (customer)/
    layout.tsx           -- nav & branding customer
    page.tsx             -- landing + entry point request
  (sales)/
    sales/
      layout.tsx         -- nav sales + bottom nav mobile
      page.tsx           -- dashboard
  (admin)/
    admin/
      layout.tsx         -- sidebar admin
      page.tsx           -- ringkasan
  login/page.tsx         -- satu route, copy menyesuaikan host
  layout.tsx             -- root: html/body, font, token CSS
  globals.css            -- design token dari MASTER.md
proxy.ts                 -- subdomain -> rewrite + optimistic auth redirect
drizzle.config.ts
lib/
  auth/session.ts        -- createSession / getSessionUser / requireUser
  auth/guard.ts          -- requirePageUser: guard versi redirect untuk layout/page
  auth/cookie.ts         -- nama cookie saja, aman di-import proxy
  config/subdomains.ts   -- pemetaan host -> area -> prefix path, plus allowlist host
  db/index.ts            -- Drizzle + Pool (driver pg, TCP)
  db/schema.ts
  redis/index.ts         -- klien + rate limiter + key namespace
  env.ts                 -- validasi env lazy (zod)
  db/ssl.ts              -- CA pinning Supabase + kebijakan TLS per host (satu sumber)
scripts/db-probe.mts     -- cek koneksi DB read-only, list tabel/enum (`npm run db:probe`)
design-system/autonomo-id/MASTER.md
```

> Kalau nanti traffic/tim sudah besar dan tiga dashboard ini perlu deploy & scale independen, baru pertimbangkan pisah jadi repo/project Vercel terpisah — untuk tahap sekarang satu repo dengan route groups lebih simpel untuk maintain.

## 5. Skill & Plugin yang Terpasang

- **ui-ux-pro-max** — panggil skill ini untuk setiap task yang menyentuh UI: styling, layout, pemilihan palet warna, font pairing, komponen (form request mobil, kartu hot lead, CRM dashboard, dsb). **Baca `design.md` lebih dulu, bukan MASTER.md.** `design.md` adalah design system terkunci, ditulis setelah MASTER.md, dan mengalahkannya soal genre, layout, ornamen, dan copy. `design-system/autonomo-id/MASTER.md` masih berguna untuk spacing, shadow, radius, dan daftar anti-pattern; bagian Style Guidelines dan Motion di dalamnya sudah ditandai superseded. Jangan generate ulang design system kecuali brand berubah.
- Terpasang juga: `typescript-lsp`, `feature-dev` (agent `code-architect`/`code-explorer`/`code-reviewer`), `vercel-storage`.

### Palet aktual dan penyimpangan yang disengaja

Nilai token hidup di satu tempat: `app/globals.css`. Jangan pernah menulis hex, `rgb()`, atau `oklch()` di dalam komponen — panggil nama tokennya.

- **Palet: putih 60 / biru elektrik 20 / ink 20.** `--color-primary` = `#0052FF` (aksi berikutnya dan angka yang dicari user), `--color-accent` = `#0B0B0C` (band ink), surface putih. Diadopsi 2026-08-16 dari mockup `beranda-user.md`; sebelumnya merah Rosso Corsa `#d40000`. Yang berubah hanya nilai — nama dan peran token tidak bergeser, jadi 582 pemakaian class ikut berganti arti tanpa diedit. Komentar mana pun di repo yang masih menyebut `--color-primary` merah sudah basi, bukan otoritatif.
- **Dua aksen di luar budget, satu tugas masing-masing.** `--color-secondary` = `#BC0000` untuk *deal heat* (badge kampanye, label kedaluwarsa), nilainya sama dengan `--color-destructive` — karena satu hue melayani dua makna, error wajib membawa ikon **dan** teks. `--color-success` = `#0C7A53` (5,3:1 di atas putih) satu-satunya hijau yang boleh membawa teks; `--color-success-fill` = `#10B981` cuma 2,4:1, jadi fill/titik/ikon saja. `text-success-fill` itu bug, bukan pilihan gaya.
- **Surface kartu putih** — bukan `#FBF8FF` seperti mockup, bukan `#FAF5FF` seperti MASTER.md. Kalau background halaman dan background kartu bernilai sama, kartunya tak terlihat; `--color-surface` dipisah untuk itu.
- **Light mode saja.** Dark mode dihapus di commit `5cc67f9` — keputusan produk, bukan kelalaian. Tidak ada varian `dark`, dan `color-scheme: light` menahan kontrol native tetap terang di perangkat ber-OS gelap. Jangan tambahkan kembali tanpa permintaan eksplisit.
- **Font: Plus Jakarta Sans (heading) + Inter (body)**, dimuat lewat `next/font/google` di `app/layout.tsx`, self-hosted. Tidak ada keluarga ketiga dan tidak ada `@import` ke `fonts.googleapis.com`.
- Palet ini hasil **adopsi mockup, bukan brand book**. Begitu asset brand resmi Autonomo.id tersedia, ganti nilai di `:root` — jangan ganti nama tokennya.

## 6. Struktur Data Inti

Schema asli ada di `lib/db/schema.ts` (Drizzle). Ringkasan:

```
users                 (id, role, phone UNIQUE, full_name, phone_verified_at, suspended_at)
sessions              (id, user_id, area, expires_at)  -- area = subdomain penerbit
sales_profile         (user_id PK, brands[], verified_badge, premium_until,
                       token_balance, rating, transactions_won, referral_code UNIQUE)
requests              (id, customer_id, brand, model, variant, discount_wanted,
                       tier, status, flagged_reason)
leads                 (id, request_id, sales_id, tier, token_cost, status, unlocked_at)
                       UNIQUE(request_id, sales_id)
token_ledger          (id, sales_id, delta, balance_after, reason, ref_id,
                       idempotency_key UNIQUE)
unlock_pricing_rules  (id, tier, token_cost, brand?, active)  -- rule engine, admin-editable
daily_unlock_quota    (sales_id, day)     -- cap freemium 3 unlock/hari
referral_quota        (sales_id, month)   -- cap 300 token/bulan
top_discount          (brand, sales_id, discount_percent)  -- source cache Top 5/10
```

Tambahan di luar kerangka awal PRD, dan alasannya:
- `unlock_pricing_rules` — CLAUDE.md §2 mensyaratkan biaya unlock configurable admin. Tanpa tabel ini biayanya pasti jadi konstanta di kode.
- `daily_unlock_quota` / `referral_quota` — cap harian dan bulanan dihitung dari baris ter-index, bukan agregasi ledger, supaya cek cap muat di dalam transaksi unlock tanpa full scan.
- `sessions` — konsekuensi dari keputusan opaque session id (lihat §4).
- `leads.token_cost` dan `leads.tier` dibekukan saat unlock supaya perubahan harga di kemudian hari tidak menulis ulang riwayat.
- **`ranking` tidak disimpan di `top_discount`.** Rank dihitung saat query (ORDER BY discount) lalu di-cache di Redis. Kolom rank tersimpan akan basi tiap ada submission baru.

### Invarian token (jangan dilanggar)
- `token_ledger` **append-only**. Tidak ada UPDATE, tidak ada DELETE. Koreksi dibuat sebagai baris baru bertanda `admin_adjustment` atau `refund`.
- `sales_profile.token_balance` adalah **cache** dari `SUM(token_ledger.delta)`, ditulis hanya di dalam transaksi yang sama dengan insert ledger, di bawah `SELECT ... FOR UPDATE` pada baris sales. Kalau keduanya tidak cocok, ledger yang benar.
- Setiap mutasi saldo wajib punya `idempotency_key`. Webhook payment melakukan retry; tanpa kunci unik, retry akan menambah token dua kali.
- Driver database wajib driver TCP (`pg` / `drizzle-orm/node-postgres`). Driver berbasis HTTP (`neon-http`, dan sejenisnya) **tidak bisa** membuka transaksi lintas-statement, jadi tidak bisa dipakai untuk jalur unlock. `DATABASE_URL` wajib menunjuk endpoint **pooler** (Supabase port 6543 / host `-pooler` milik Neon), bukan port langsung 5432 — fungsi serverless berumur pendek dan banyak, koneksi langsung akan habis.

## 7. Yang Perlu Diingat Saat Coding

- Data customer (nomor WA, nama) **hanya boleh terlihat oleh sales setelah unlock** — jangan pernah expose di response API sebelum status unlock tercatat di `token_ledger`/`leads`.
- Validasi **input diskon** di sisi server (anti-fraud: diskon tidak masuk akal seperti >70% harus ditandai, sesuai rencana fitur AI Fraud Detection di Phase lanjutan).
- `requests.tier` ditentukan **server-side** dari brand/model, bukan dari input user — kalau tidak, customer bisa menurunkan tier dan membuat lead-nya murah untuk di-unlock.
- Semua angka di skema token/harga di atas adalah **ilustrasi bisnis** dari PRD — kalau berubah, update dokumen ini juga supaya tidak drift dari sumber kebenaran.