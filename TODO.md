# TODO — Autonomo.id

Breakdown task berdasarkan PRD (roadmap MVP → Phase 4), disusun mengikuti arsitektur di `CLAUDE.md` (Next.js + subdomain 3 dashboard + Postgres + Redis + Vercel). Checklist ini dipakai bareng, update status langsung di file ini.

---

## Phase 0 — Setup & Fondasi

- [x] Init repo Next.js (App Router) + TypeScript + Tailwind — Next.js 16.3.0, Tailwind v4
- [x] Setup route groups `(customer)`, `(sales)`, `(admin)` di `app/`
- [x] `proxy.ts` — deteksi hostname → rewrite ke route group yang sesuai (Next 16 rename `middleware.ts` → `proxy.ts`)
- [ ] Setup 3 domain di Vercel: `autonomo.id`, `sales.autonomo.id`, `admin.autonomo.id` + DNS (A/ALIAS + CNAME)
- [x] Provision database PostgreSQL — Supabase, `DATABASE_URL` (pooler port 6543) sudah masuk `.env.local`
- [x] Provision Redis — Upstash, kredensial sudah masuk `.env.local`
- [ ] Setup env vars di Vercel project settings (`.env.example` sudah jadi template)
- [x] Jalankan skill `ui-ux-pro-max` → design token ada di `design-system/autonomo-id/MASTER.md`, sudah diturunkan ke `app/globals.css`
- [x] Setup `lib/db`, `lib/redis`, `lib/auth` skeleton
- [x] Migration awal: 10 tabel + 5 enum, `drizzle/0000_military_jean_grey.sql` — **sudah diterapkan** ke database (verifikasi: `npm run db:probe`)
- [x] Security pass: CSP nonce, HSTS, host allowlist, anti open-redirect, HMAC session, guard role di layout sales/admin, `robots.ts`

**Phase 0 selesai** kecuali setup domain + env vars di Vercel (baru relevan saat deploy).


---

## Phase 1 — MVP

### Auth (shared, semua subdomain)
- [ ] Integrasi WhatsApp OTP API (kirim & verifikasi kode) — provider belum dipilih
- [x] Rate-limit OTP via Redis — `otpRateLimiter()` di `lib/redis/index.ts`, 3 kirim per nomor per 15 menit
- [x] Session/cookie strategy — **isolasi per-subdomain** (cookie host-only, tanpa atribut `Domain`), opaque session id di tabel `sessions`
- [x] Role guard di proxy (optimistic redirect) + `requireUser(area)` untuk validasi asli dari DB
- [ ] Halaman `/login` masih statis — form belum tersambung ke server action


### Customer (`autonomo.id`)
- [ ] Landing page (hero, value prop — hindari template generic, ground di dunia otomotif)
- [ ] Form request mobil: brand, model, tipe, varian, diskon diinginkan, estimasi waktu beli (opsional)
- [ ] Halaman tracking request: status, sales yang ambil, profil sales dasar (belum full rating/verified — itu Phase 2)
- [ ] Validasi server-side untuk semua input form

### Sales (`sales.autonomo.id`)
- [ ] Dashboard list hot leads (data customer disembunyikan sebelum unlock — hanya brand + diskon diminta yang tampil)
- [ ] Rule engine biaya unlock per tier mobil (low/mid/high) — configurable, bukan hardcode
- [ ] Flow unlock lead: cek saldo token → kurangi via transaction lock di Postgres (`FOR UPDATE`/`SERIALIZABLE`) → catat di `token_ledger` → buka data customer (nomor WA)
- [ ] Freemium logic: grant 100 token saat registrasi, limit 3 unlock/hari (cek & reset harian)
- [ ] Halaman referral: generate link, catat +30 token per referral sukses, cap 300 token/bulan

### Admin (`admin.autonomo.id`)
- [ ] Dashboard admin basic (list users, list requests, list leads)
- [ ] User management (lihat/suspend customer & sales)
- [ ] Lead management (tracking status request)
- [ ] Credit/transaction management (lihat `token_ledger`, adjust manual kalau perlu)
- [ ] Konfigurasi rule engine biaya unlock (CRUD tier & range token)

### Payment
- [ ] Integrasi payment gateway (Midtrans/Xendit) untuk top-up token
- [ ] Webhook handler (`api/webhooks/payment`) — di luar route group subdomain
- [ ] Idempotency check di webhook (hindari token masuk dobel kalau webhook retry)

### QA MVP
- [ ] Test race condition unlock lead (2 device unlock bersamaan)
- [ ] Test responsive mobile untuk sales dashboard (dipakai di lapangan)
- [ ] Deploy staging ke Vercel, smoke test 3 subdomain

---

## Phase 2 — Premium & Bid Credit

- [ ] Premium membership: flow subscribe + billing recurring
- [ ] Verified badge di profil sales premium
- [ ] CRM dashboard full access (vs limited di free tier)
- [ ] Profil publik sales dengan statistik dasar (jumlah transaksi, belum termasuk review — itu Phase 3)
- [ ] Bid Credit System aktif (sales bersaing kasih diskon, bukan cuma unlock pasif)
- [ ] Status lead lengkap: Pending → Negotiation → Won → Lost, dengan catatan internal follow-up
- [ ] Dealer-sponsored rewards (struktur data + admin panel untuk kelola reward)

---

## Phase 3 — Campaign & Reputasi

- [ ] Top 5/10 Diskon: query ranking real-time per brand di Postgres
- [ ] Cache hasil ranking di Redis (TTL pendek, invalidate saat ada submission baru)
- [ ] Tampilan Top 5/10 di customer landing (desain leaderboard yang punya karakter — signature element sesuai prinsip desain di `CLAUDE.md`)
- [ ] Profil publik sales lengkap + review dari customer
- [ ] Sistem rating pasca-transaksi

---

## Phase 4 — Scale & AI (12 bulan+)

- [ ] Mobile app (evaluasi: React Native / Flutter — belum diputuskan di PRD)
- [ ] AI Lead Scoring — model prediksi kemungkinan closing, prioritas hot lead
- [ ] AI Matching Engine — rekomendasi sales ke customer otomatis
- [ ] AI Chatbot WhatsApp (customer & sales auto-reply)
- [ ] AI Price & Discount Predictor
- [ ] AI Fraud & Fake Data Detection (deteksi diskon tidak masuk akal, mis. >70%)
- [ ] AI-Powered CRM untuk sales premium (insight closing, reminder follow-up otomatis)

> Prioritas AI sesuai PRD: **Lead Scoring → Matching Engine → Chatbot WA**, sisanya menyusul setelah volume data cukup.

---

## Cross-cutting (jalan terus di semua phase)

- [ ] Update `CLAUDE.md` tiap ada perubahan schema/skema token supaya tidak drift dari PRD
- [ ] Analytics & reporting admin: leads/hari, top performing sales, conversion rate
- [ ] Security review berkala: akses data customer, validasi role, rate-limit endpoint sensitif
- [ ] Monitoring uptime (target 99.9% sesuai NFR di PRD)