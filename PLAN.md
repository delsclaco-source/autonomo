# Autonomo.id — Rencana Kerja

> Diperbarui 2026-08-09. Disinkronkan dengan 5 dokumen di `autonomo-dokuemtasi/`, `CLAUDE.md`, `TODO.md`, dan hasil code review (15 temuan).
>
> Ada 11 konflik antara dokumen dan kode. Bagian 0 harus diputuskan sebelum Fase 2 ke atas dikerjakan, karena empat di antaranya mengubah schema database.

---

## 0. Konflik dokumen vs kode — putuskan dulu

| # | Isu | Dokumen | Kode sekarang | Dampak | Rekomendasi |
|---|---|---|---|---|---|
| 0.1 | Nama brand | **Automo.id** (5 dokumen, konsisten) | **Autonomo.id** (`CLAUDE.md`, domain, aset banner) | Semua copy, metadata, OG, email, dan nama domain | Pakai **Autonomo.id** — domain sudah dibeli dan ada di aset. Perbaiki dokumen, bukan kode |
| 0.2 | Palet warna | Deep Navy + Electric Blue, aksen hijau/oranye, merah hanya kritis | Merah/hitam/putih di `app/(customer)/page.tsx`; `MASTER.md` justru ungu+hijau | Tiga sumber warna berbeda, tidak ada yang menang | Pilih satu. Navy+Electric Blue dari dokumen paling cocok untuk "premium automotive trust". Generate ulang token di `globals.css` |
| 0.3 | **Satuan diskon** | Rupiah absolut (`Target Discount: Rp35 Juta`, `Maximum Discount Rp40 Juta`) | `requests.discount_wanted` = **persen** `numeric(5,2)` | Matching engine di dokumen membandingkan rupiah lawan rupiah. Persen tidak bisa dibandingkan lintas model tanpa harga OTR | Simpan **keduanya**: `target_price` (rupiah, sumber input) + `discount_wanted` (persen, turunan). `lib/validation/request.ts` sudah menghitung keduanya tapi hanya persen yang disimpan |
| 0.4 | Status lead | 5 status: New → **Contacted** → Negotiation → Won → Lost | enum 4 status, **`contacted` tidak ada** | Pipeline CRM dan Kanban di dokumen tidak bisa dibangun | Tambah `contacted` ke `lead_status` enum via migration |
| 0.5 | **Profil publik sales** | URL `/sales/[sales-slug]` di domain customer | `/sales/*` adalah namespace internal dashboard sales; `proxy.ts:83` mem-404 `/sales` dari host customer | Fitur reputasi publik (jualan utama ke customer) tidak bisa di-route | Pindahkan ke `/sales-profile/[slug]` atau `/s/[slug]`, atau ubah prefix internal sales jadi `/dashboard`. Keputusan arsitektur, bukan copy |
| 0.6 | Verifikasi sales | 3 status: Pending / Verified / **Rejected** + resubmit dokumen | `verified_badge boolean` | Tidak ada cara menyatakan "ditolak, perbaiki data" | Ganti jadi enum `verification_status` + `verification_note` |
| 0.7 | **Discount inventory** | Inti matching engine: per brand/model/varian → max discount, min negotiable, tipe, periode promo, benefit, catatan | **Tabel tidak ada** | Seluruh nilai jual "Masukkan penawaranmu, kami carikan customer" belum punya tempat penyimpanan | Tabel baru `sales_offers` + `offer_benefits`. Ini pekerjaan terbesar yang belum tersentuh |
| 0.8 | Match Score & Lead Score | 96% match, 92/100 lead score, breakdown 6 dimensi | Tidak ada | Kartu lead, prioritas lead, ranking sales | Fase 4 (match) dan Fase 9 (lead score). Simpan bobot di config, bukan hardcode di query |
| 0.9 | Coverage area | Province → City → District, multi-area, opsi nasional | `sales_profile.city text` tunggal | Salah satu parameter matching hilang | Tabel `sales_coverage` (sales_id, province, city, district?) + flag `nationwide` |
| 0.10 | Data registrasi | Email, foto profil, posisi, pengalaman, bio, dealer branch/alamat/provinsi/telepon, employee ID, dokumen verifikasi | `users`: phone, full_name. `sales_profile`: dealer_name, city, brands[] | Onboarding 8 langkah di dokumen tidak punya kolom | Perluas `sales_profile` + tabel `sales_documents` (privat, jangan pernah publik) |
| 0.11 | Paket token | Starter 100, Basic 260, Pro 530, Premium 1.100, Ultimate 2.300 | `lib/sales/packages.ts` — 250+10, 500+30, 1.000+100, 2.000+300 | Tidak ada. Totalnya identik | **Sudah sinkron.** Tidak perlu diubah |

Catatan tambahan: repo ini **belum git repository**. `git init` + commit awal sebelum mulai, supaya semua perubahan di bawah bisa di-review dan di-rollback.

---

## Fase 1 — Perbaikan blocker (1–2 hari, tidak ada dependensi)

Hasil code review. Tiga yang pertama membuat aplikasi tidak bisa dipakai sama sekali; sisanya salah tagih atau salah tampil. Kerjakan sebelum menambah fitur apa pun.

### 1.1 Routing dashboard 404 total — CRITICAL
- [ ] `proxy.ts:118` — prefix area ditambahkan tanpa syarat, padahal `lib/config/nav.ts:67-73` sudah memuat `/sales`. Hasilnya `/sales/sales/leads`
- [ ] Pilih satu: (a) hapus prefix dari semua href + `defaultLanding()` + `revalidatePath()`, atau (b) proxy hanya menambah prefix kalau `pathname` belum diawali prefix
- [ ] Rekomendasi (a) — href tanpa prefix konsisten dengan URL yang dilihat user
- [ ] Sentuh: `lib/config/nav.ts`, `app/login/actions.ts:172-176`, `app/(sales)/sales/actions.ts` (semua `revalidatePath`), `app/(sales)/sales/leads/unlock-button.tsx:39,77`, semua `Link` di layout sales/admin
- [ ] Verifikasi: klik kelima menu sales + kelima menu admin setelah login

### 1.2 Harga unlock beda antara tampilan dan tagihan — HIGH
- [ ] `lib/sales/queries.ts:208` — `unlockPrices()` dipanggil tanpa brand; `lib/sales/unlock.ts` menagih harga brand-specific
- [ ] Perbaikan: hitung harga per baris dengan brand-nya, atau join `unlock_pricing_rules` di query marketplace
- [ ] Ikut memperbaiki `unlock-button.tsx:34` (`short = balance < tokenCost`) yang saat ini bisa menampilkan tombol aktif untuk saldo yang tidak cukup

### 1.3 OTP terkirim tapi tidak pernah bisa diverifikasi — HIGH
- [ ] `lib/whatsapp/client.ts:122` — `looksRejected()` mencocokkan substring `error`/`invalid` ke seluruh body; respons sukses ber-`"error":null` dianggap gagal → `persist()` dilewati
- [ ] Ganti ke pengecekan field eksplisit sesuai kontrak gateway yang dipilih (provider belum ditentukan, lihat Fase 3.1)
- [ ] Sampai provider final: fallback aman = anggap sukses kalau HTTP 2xx dan tidak ada field error yang dikenali

### 1.4 Sisanya
- [ ] `app/(sales)/sales/actions.ts:129` — `saveLeadNoteAction` tidak cek baris terupdate, `leadId` orang lain balik `success`. Pakai `.returning()` seperti `updateLeadStatusAction:107-111`
- [ ] `lib/sales/queries.ts:331` — batas bulan UTC vs `referral_quota.month` Asia/Jakarta. Pakai helper zona waktu yang sama dengan tabel kuota
- [ ] `proxy.ts:133` — matcher `.*\..*` mengeluarkan path bertitik dari proxy, blok 404 wrong-host dan CSP terlewati. Jangkarkan klausa ekstensi
- [ ] `app/login/login-form.tsx:28,97` — resend gagal melempar user kembali ke input nomor; cooldown tidak di-arm ulang. Pisahkan state resend dari state kirim awal
- [ ] `lib/env.ts:30` — `serverEnv()` tidak pernah dipanggil. Panggil di `lib/db/index.ts`, `lib/auth/session.ts`, `lib/auth/otp.ts`, `lib/whatsapp/client.ts`
- [ ] `lib/db/index.ts:41` — `rejectUnauthorized: false`. Pin CA Supabase
- [ ] `lib/auth/otp.ts:150` — `attemptsLeft` meleset satu
- [ ] `app/(customer)/request/page.tsx:190` — pakai `timeframeLabel()`, bukan slug mentah
- [ ] `app/(customer)/request/page.tsx:78` — "request aktif" dihitung dari semua baris termasuk `closed`/`expired`
- [ ] `next.config.ts:47` — tambah `'/(sales|admin)'` supaya root dashboard ikut `noindex`

---

## Fase 2 — Migration schema (2 hari, butuh keputusan Bagian 0)

Satu migration besar lebih baik daripada lima kecil, karena tabel-tabel ini saling mereferensi.

### 2.1 Perluasan tabel yang ada
- [ ] `users`: `email text` (opsional, dari Step 1 dokumen registrasi)
- [ ] `requests`: `target_price bigint` — sumber input rupiah (konflik 0.3)
- [ ] `requests`: `city`, `province` — parameter matching lokasi
- [ ] `leads`: tambah `contacted` ke enum `lead_status` (konflik 0.4)
- [ ] `leads`: `last_contacted_at`, `next_follow_up`, `lost_reason` (enum: price/competitor/no_response/postponed/wrong_lead/other)
- [ ] `sales_profile`: `photo_url`, `position`, `experience_years`, `bio`, `slug UNIQUE`, `response_rate`, `avg_response_minutes`
- [ ] `sales_profile`: ganti `verified_badge boolean` → `verification_status` enum + `verification_note` (konflik 0.6)
- [ ] `sales_profile`: `nationwide boolean`

### 2.2 Tabel baru
- [ ] `sales_offers` — `id, sales_id, brand, model, variant, otr_price, max_discount, min_discount, discount_type, campaign_name, starts_at, ends_at, status (draft/active/paused/expired), created_at, updated_at`. Index `(brand, model, status)`
- [ ] `offer_benefits` — `offer_id, benefit` (free_service / free_insurance / free_accessories / free_coating / other + `note`)
- [ ] `sales_coverage` — `sales_id, province, city, district` (konflik 0.9)
- [ ] `sales_documents` — `sales_id, kind, storage_path, uploaded_at`. **Tidak pernah dieksekusi ke response publik** (dokumen §31)
- [ ] `dealers` — `id, name, branch, address, city, province, phone`. Searchable dropdown di Step 3
- [ ] `notifications` — `id, user_id, kind, payload jsonb, read_at, created_at`
- [ ] `lead_activities` — `lead_id, kind, note, created_at`. Sumber Activity Timeline (dokumen CRM §6)

### 2.3 Invarian yang harus dijaga
- [ ] `sales_offers.min_discount` **tidak boleh** keluar ke response customer — hanya `max_discount` yang publik (dokumen §15)
- [ ] Offer lewat `ends_at` otomatis `expired` dan keluar dari matching. Vercel Cron harian, bukan job long-running
- [ ] `token_ledger` tetap append-only, `idempotency_key` wajib — tidak berubah

---

## Fase 3 — Auth & onboarding sales (4–5 hari, butuh Fase 2)

Sumber: `SALES REGISTRATION, PROFILE & DISCOUNT MATCHING PLATFORM.md` §7–§13, §24–§29.

### 3.1 WhatsApp OTP — selesaikan
- [ ] Pilih provider (belum diputuskan di `TODO.md`). Kontrak respons menentukan perbaikan 1.3
- [ ] Uji: kirim, resend dalam cooldown, salah kode 5×, kode kedaluwarsa

### 3.2 Wizard 8 langkah
- [ ] Step indicator + progress bar ("Step 4 of 8")
- [ ] Step 1 Account: nama, WhatsApp, email
- [ ] Step 2 Sales Profile: foto, posisi, pengalaman, bio + **live preview** di desktop
- [ ] Step 3 Dealer: dropdown dealer searchable, cabang, alamat, kota, provinsi, telepon, employee ID, upload dokumen
- [ ] Step 4 Brand: multi-select dari katalog
- [ ] Step 5 Model & Varian: varian auto-load setelah model dipilih (dokumen §27 — jangan suruh ketik manual)
- [ ] Step 6 Discount: kartu konfigurasi per model (masuk `sales_offers`)
- [ ] Step 7 Coverage: provinsi/kota/kecamatan multi + opsi nasional
- [ ] Step 8 Verification: status pending + ringkasan
- [ ] **Autosave + continue later** — wizard 8 langkah tanpa autosave akan ditinggal di tengah
- [ ] Profile completion score + checklist

### 3.3 Mobile
- [ ] Satu section per layar, sticky bottom CTA "Lanjutkan"
- [ ] Input diskon pakai keyboard numerik, tampilkan `≈ 4.7%` otomatis dari OTR

---

## Fase 4 — Discount inventory & matching engine (4–5 hari, butuh Fase 3)

Ini nilai jual inti produk ke sales dan belum ada sama sekali.

### 4.1 My Offers (dokumen §18–§19)
- [ ] `/sales/offers` — daftar per brand, status Active/Expired/Draft
- [ ] Flow "+ Tambah Penawaran": brand → model → varian → diskon → benefit → periode → review → publish
- [ ] Preview sebelum publish
- [ ] Edit / pause / delete / perpanjang periode

### 4.2 Match score
- [ ] Fungsi murni `matchScore(request, offer, profile)` di `lib/matching/score.ts` — bisa di-unit-test tanpa DB
- [ ] Dimensi + bobot dari dokumen §17: vehicle, discount, location, availability, reputation, timing
- [ ] Bobot di config, bukan angka sebar di query
- [ ] Prioritas urutan dari dokumen §26 (brand → model → varian → kompetitif diskon → lokasi → timeline → verifikasi → rating → histori → respons)
- [ ] **Jangan expose algoritma** — hanya skor akhir + breakdown persen

### 4.3 Matched leads
- [ ] Marketplace lead diurutkan match score, bukan hanya `created_at DESC`
- [ ] Kartu "NEW MATCHED LEAD" (dokumen §20): target customer, penawaran Anda, match score, timeline, unlock cost
- [ ] Data customer tetap tersembunyi sebelum unlock — invarian `CLAUDE.md` §7 tidak boleh dilanggar oleh fitur matching

---

## Fase 5 — Customer landing page (3 hari, tidak ada dependensi)

Sumber: `CUSTOMER LANDING PAGE.md`. Sekarang ada ~30% (banner, inline request bar, grid katalog, band rekrutmen sales).

- [ ] Header sticky: logo, Cari Mobil, Promo & Diskon, Sales Terpercaya, Cara Kerja, Login, CTA "Request Mobil"
- [ ] Hero: headline "Cari Mobil Baru, Dapatkan Diskon Terbaik." — **saat ini dikomentari** di `app/(customer)/page.tsx:49-57`
- [ ] Trust bar: 10.000+ Sales · 100+ Dealer · Verified Sales · WhatsApp Terverifikasi
- [ ] Cara kerja 3 langkah
- [ ] Top diskon inline (Top 5 + link Top 10) dengan tab brand
- [ ] Section sales terpercaya (butuh Fase 3 untuk data asli; pakai empty state dulu)
- [ ] Why Automo: 4 kartu benefit
- [ ] FAQ 7 pertanyaan (accordion)
- [ ] Final CTA + footer lengkap
- [ ] Sticky bottom CTA "Request Mobil" di mobile

---

## Fase 6 — Sales landing page (2 hari, tidak ada dependensi)

Sumber: `SALES LANDING PAGE.md`. **Belum ada file sama sekali** — `sales.autonomo.id` langsung minta login.

- [ ] Halaman publik di area sales (di luar guard auth, tambahkan ke `PUBLIC_PATHS` di `proxy.ts:25`)
- [ ] Hero "Stop Canvassing. Mulai Dapatkan Hot Lead." + CTA "Daftar Gratis — Dapatkan 100 Token"
- [ ] 4 kartu value proposition
- [ ] Cara kerja 5 langkah
- [ ] Hot lead preview (data customer tersamar — mendemokan model bisnis)
- [ ] Kartu paket token dari `lib/sales/packages.ts` (sudah sinkron, jangan tulis ulang angkanya)
- [ ] Premium membership, reputasi sales, CRM preview, referral, FAQ 8 pertanyaan, final CTA

---

## Fase 7 — Admin panel (3–4 hari, butuh Fase 2)

Sumber: `CLAUDE.md` §1 + `TODO.md` Phase 1. Sekarang `app/(admin)/admin/page.tsx` hanya placeholder 13 baris.

- [ ] Sidebar: Dashboard, Users, Leads, Transactions, Pricing, **Verifikasi Sales**, Analytics
- [ ] `/admin/users` — tabel, filter role, suspend/unsuspend, cari nomor/nama
- [ ] `/admin/leads` — filter status/tier/flagged, detail siapa yang unlock
- [ ] `/admin/transactions` — read-only ledger, filter reason
- [ ] `/admin/pricing` — CRUD `unlock_pricing_rules`. **Wajib** — tanpa ini biaya unlock tidak configurable seperti syarat `CLAUDE.md` §2
- [ ] `/admin/verifications` — antrean dokumen sales, approve/reject + catatan (konflik 0.6)
- [ ] `/admin` — metrik: total user, request, unlock, revenue token, top sales
- [ ] Review request `flagged` (diskon > 30%) — sekarang ditandai tapi tidak ada yang meninjau

---

## Fase 8 — CRM lengkap (4 hari, butuh Fase 2)

Sumber: `SALES CRM DASHBOARD.md`. Yang ada sekarang: kartu lead + status + catatan + tombol WhatsApp.

- [ ] Metrik lengkap: Total Leads, Active Leads, Negotiation, Won, Conversion Rate, Token Balance — semua bisa diklik
- [ ] Status `contacted` masuk tab dan tombol
- [ ] Pipeline Kanban drag-and-drop 5 kolom
- [ ] Lead detail: activity timeline dari `lead_activities`, informasi customer lengkap, catatan internal
- [ ] Follow-Up Center: Overdue / Due Today / Upcoming
- [ ] Won leads + Lost leads dengan alasan kalah
- [ ] Analytics: funnel konversi, leads per bulan, won vs lost, performa brand, filter 7/30/90/365 hari
- [ ] Search + filter + sort + pagination
- [ ] Confirmation modal sebelum token dipotong, toast setelah unlock (dokumen: "Never make the Token system feel deceptive")

---

## Fase 9 — Top diskon data asli (2 hari, butuh Fase 4)

- [ ] Sumber ranking dari `sales_offers` aktif, bukan `lib/data/demo-market.ts`
- [ ] Query `ORDER BY discount DESC LIMIT 10` + join `sales_profile`/`users` untuk nama, badge, rating
- [ ] Cache Redis `top_discount:{brand}` TTL 60 detik, invalidate saat offer berubah
- [ ] Rank dihitung saat query, **tidak disimpan** (`CLAUDE.md` §6)
- [ ] Empty state per tab brand, hapus banner "data contoh"

---

## Fase 10 — Payment (3 hari, butuh Fase 1)

- [ ] Pilih gateway (Midtrans / Xendit)
- [ ] Checkout dari `/sales/topup` — paket sudah ada di `lib/sales/packages.ts`
- [ ] Webhook di `app/api/webhooks/payment` — **di luar matcher proxy** (`proxy.ts:133` sudah mengecualikan `api/webhooks`)
- [ ] Kredit token dalam transaksi + `idempotency_key` format `<provider>:<event_id>`
- [ ] Dua baris ledger: pembelian dan bonus, terpisah (sesuai komentar `packages.ts`)
- [ ] Uji retry webhook — kirim event yang sama 3× dan pastikan saldo hanya naik sekali

---

## Fase 11 — Notifikasi & profil publik (3 hari, butuh Fase 2 + keputusan 0.5)

- [ ] Bell icon + unread count di header sales
- [ ] Event: lead cocok baru, respons customer, reminder follow-up, transaksi sukses, top-up, bonus referral, premium
- [ ] Profil publik sales di URL hasil keputusan 0.5 — foto, badge, rating, transaksi, response rate, active offers
- [ ] Halaman "Sales Terpercaya" di area customer menautkan ke sini

---

## Fase 12 — Lead scoring & AI (5+ hari, butuh akumulasi data)

- [ ] `requests.lead_score` — bobot: urgensi 0.3, realisme diskon 0.2, aktivitas customer 0.2, kelengkapan request 0.15, histori konversi 0.15
- [ ] Komponen UI siap-AI tanpa AI sungguhan dulu (dokumen CRM §16): AI Lead Score, Follow-Up Recommendation, Closing Prediction, Lead Recommendation
- [ ] Fraud detection lanjutan — threshold 30% sekarang di `lib/validation/request.ts:23`, dokumen menyebut >70%. Samakan dulu angkanya

---

## Fase 13 — Polish & rilis (2–3 hari, berjalan terus)

- [ ] `loading.tsx` + skeleton di semua halaman fetch data
- [ ] `not-found.tsx`, `error.tsx`
- [ ] Empty state bermakna + CTA di semua list
- [ ] Toast (`components/ui/sonner.tsx` sudah ada, belum dipakai)
- [ ] Metadata + OG image semua halaman publik
- [ ] Unit test: `lib/sales/unlock.ts` (race condition), `lib/validation/request.ts` (tier, fraud), `lib/matching/score.ts`
- [ ] Integration test: alur OTP
- [ ] E2E: request customer → unlock sales → status CRM
- [ ] Setup domain + env vars di Vercel (`TODO.md` Phase 0, dua item tersisa)
- [ ] Smoke test 3 subdomain di staging

---

## Urutan & estimasi

```
Fase 1 (blocker)     1–2 hari  ── wajib pertama, tanpa dependensi
   │
Fase 2 (migration)   2 hari    ── butuh keputusan Bagian 0
   ├── Fase 5 (customer landing)  3 hari   ─┐ paralel, tanpa dependensi
   ├── Fase 6 (sales landing)     2 hari   ─┤
   ├── Fase 7 (admin)             3–4 hari ─┘
   │
Fase 3 (onboarding)  4–5 hari
   │
Fase 4 (matching)    4–5 hari  ── nilai jual inti
   │
   ├── Fase 8 (CRM)      4 hari
   ├── Fase 9 (top diskon) 2 hari
   ├── Fase 10 (payment)  3 hari
   ├── Fase 11 (notif)    3 hari
   │
Fase 12 (AI)         5+ hari   ── butuh data
Fase 13 (polish)     2–3 hari  ── terus-menerus
```

| Milestone | Fase | Estimasi |
|---|---|---|
| **Aplikasi bisa dipakai** | 1 | 1–2 hari |
| **MVP demo-able** | 1, 2, 5, 6, 7 | 11–15 hari |
| **Produk sesuai dokumen** | + 3, 4, 8, 9, 10 | 28–34 hari |
| **Siap rilis** | + 11, 13 | 33–40 hari |

Angka di atas untuk satu developer. Fase 5, 6, dan 7 bisa diparalelkan karena tidak saling menyentuh file.

## Invarian yang tidak boleh dilanggar di fase mana pun

1. Nama dan nomor WhatsApp customer tidak pernah keluar sebelum unlock tercatat di `leads` + `token_ledger`
2. `min_discount` sales tidak pernah keluar ke customer
3. Dokumen verifikasi tidak pernah publik
4. `token_ledger` append-only; koreksi = baris baru `admin_adjustment`/`refund`
5. Setiap mutasi saldo punya `idempotency_key` dan berjalan di bawah `SELECT ... FOR UPDATE`
6. `requests.tier` dan `discount_wanted` dihitung server-side dari katalog, bukan input klien
7. Otorisasi asli di `requireUser(area)`, bukan di proxy

