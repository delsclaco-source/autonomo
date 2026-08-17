/**
 * Copy and demo content for the sales recruitment page.
 *
 * Kept out of the page component for two reasons: the page is otherwise mostly
 * markup, and every number here is a claim the business has to stand behind — a
 * reviewer should be able to read them all in one place without stepping through
 * JSX.
 *
 * THE PAGE LEADS WITH THE AUCTION, NOT THE TOKEN. That order is not a marketing
 * choice, it is what the code does. `app/(customer)/request/baru/actions.ts`
 * opens an auction for every request whose target price is plausible, and only a
 * flagged request — or an auction that closed without a single valid bid — falls
 * through to `status: 'pool'`, which is the lane tokens buy. `lib/auction/settle.ts`
 * writes the winning lead with `token_cost: 0`. The earlier version of this file
 * sold "pay tokens for every lead" as the product; that described the fallback.
 *
 * DEMO DATA WARNING. `PREVIEW_AUCTIONS`, `PREVIEW_LEADS`, `PREVIEW_SALES` and
 * `PREVIEW_PIPELINE` are illustrations, not queries. They exist because a
 * recruitment page whose auction and lead sections are empty on launch sells
 * nothing. They are labelled as examples in the UI — a fabricated lead a visitor
 * mistakes for a live one is a lie, and the page says so on the card itself.
 * Replace them with real aggregates (never a real customer's name or number) once
 * there is volume.
 *
 * `PREVIEW_AUCTIONS` deliberately carries no rival's price, only a rank and a
 * bidder count. `activeAuctionsForSales` in `lib/auction/queries.ts` projects a
 * competitor's `bestPrice` out of its result on purpose; an illustration that
 * showed one would advertise a screen the product does not have.
 *
 * Where the numbers come from:
 * - Auction timing — `lib/auction/queries.ts`: `AUCTION_DURATION_MS` 48 hours,
 *   `SOFT_CLOSE_WINDOW_MS` and `SOFT_CLOSE_EXTENSION_MS` 5 minutes,
 *   `MAX_SOFT_CLOSE_EXTENSIONS` 6, so the tail is capped at 30 extra minutes.
 * - Token figures — CLAUDE.md § 2: 100 free on signup, 3 unlocks/day on freemium,
 *   +30 per referral capped at 300/month, unlock 5–10 / 20–30 / 50–100 by tier.
 * - Package prices are not repeated here. `lib/sales/packages.ts` is the single
 *   source and the page reads it directly.
 */

/** Icon names resolved by the page; see its `lucide-react` imports. */
export type SectionIcon =
  | 'gavel'
  | 'target'
  | 'coins'
  | 'whatsapp'
  | 'car'
  | 'wallet'
  | 'map'

export type ValueProp = {
  icon: SectionIcon
  title: string
  body: string
}

export const VALUE_PROPS: readonly ValueProp[] = [
  {
    icon: 'gavel',
    title: 'Lelang, bukan rebutan nomor',
    body: 'Setiap request dengan target harga wajar dibuka sebagai lelang 48 jam. Anda bersaing lewat harga, bukan lewat siapa yang menelepon lebih dulu.',
  },
  {
    icon: 'target',
    title: 'Target harga terlihat sebelum Anda menawar',
    body: 'Angka yang customer harapkan tampil di kartu lelang. Anda cukup memutuskan sanggup atau tidak, tanpa menggali informasi lewat telepon.',
  },
  {
    icon: 'whatsapp',
    title: 'Menang berarti kontak terbuka',
    body: 'Pemenang lelang mendapat nama dan nomor WhatsApp terverifikasi customer, tanpa memotong token. Pesan pembuka sudah terisi model dan harga yang Anda janjikan.',
  },
  {
    icon: 'coins',
    title: 'Token hanya untuk jalur sisa',
    body: 'Request bertarget di luar batas wajar dan lelang yang tutup tanpa satu bid pun jatuh ke token pool. Di situ token dipakai, dan biayanya tampil sebelum tombol ditekan.',
  },
]

export type Step = {
  title: string
  body: string
}

export const STEPS: readonly Step[] = [
  {
    title: 'Daftar gratis',
    body: 'Verifikasi nomor WhatsApp Anda. Saldo awal 100 token langsung masuk, dipakai nanti untuk jalur token pool.',
  },
  {
    title: 'Publikasikan penawaran Anda',
    body: 'Isi brand, model, harga OTR, dan diskon maksimum yang Anda sanggupi. Ini syaratnya: tanpa penawaran aktif untuk sebuah model, lelang model itu tidak muncul di layar Anda.',
  },
  {
    title: 'Menawar di lelang',
    body: 'Lelang berjalan 48 jam dan menawar tidak memakai token. Anda melihat peringkat dan jumlah penawar Anda sendiri, tidak pernah harga pesaing.',
  },
  {
    title: 'Menang, lalu hubungi customer',
    body: 'Harga terdalam menang; bila seri, yang menawar lebih dulu menang. Kontak customer terbuka dengan biaya 0 token, dan harga yang Anda tawarkan tercatat sebagai komitmen.',
  },
  {
    title: 'Atau ambil dari token pool',
    body: 'Request bertarget tak wajar dan lelang tanpa bid valid pindah ke pool. Di sana lead dibuka dengan token, biaya per tier tertulis di kartunya.',
  },
  {
    title: 'Kelola sampai closing',
    body: 'Catat status di CRM: dihubungi, negosiasi, menang, kalah — plus catatan internal yang tidak pernah terlihat customer.',
  },
]

/**
 * Auction mechanics as figures, so a visitor can check them against the FAQ
 * instead of taking a paragraph on faith. Traced to the constants in
 * `lib/auction/queries.ts` — see the note at the top of this file.
 */
export type AuctionFact = {
  label: string
  value: string
  hint: string
}

export const AUCTION_FACTS: readonly AuctionFact[] = [
  { label: 'Durasi lelang', value: '48 jam', hint: 'Dihitung sejak request customer masuk' },
  { label: 'Biaya menawar', value: '0 token', hint: 'Termasuk bagi sales yang menang' },
  {
    label: 'Perpanjangan otomatis',
    value: '5 menit',
    hint: 'Bid terbaik di 5 menit terakhir menunda penutupan, maksimal 6 kali',
  },
]

/**
 * The three dimensions the matching engine works on.
 *
 * `live` means a query enforces it today, and the copy names which rule. `soon`
 * means the columns exist in `lib/db/schema.ts` and nothing reads them yet — a
 * repo-wide search for `sales_coverage`, `salesCoverage` and `nationwide` outside
 * the schema returns nothing, and `lib/sales/queries.ts` takes no province or
 * city parameter. design.md § 9 requires that to be said plainly rather than
 * implied, so the third item carries "Segera hadir" and makes no claim.
 */
export type MatchDimension = {
  icon: SectionIcon
  title: string
  body: string
  detail: string
  status: 'live' | 'soon'
}

export const MATCH_DIMENSIONS: readonly MatchDimension[] = [
  {
    icon: 'car',
    title: 'Spesifikasi kendaraan',
    body: 'Lelang hanya muncul untuk brand dan model yang Anda punya penawaran aktifnya. Ini bukan filter yang bisa dimatikan — kalau penawarannya tidak ada, lelangnya tidak ada.',
    detail: 'Dicocokkan pada brand, model, dan masa berlaku penawaran Anda.',
    status: 'live',
  },
  {
    icon: 'wallet',
    title: 'Kapasitas diskon',
    body: 'Diskon maksimum yang Anda publikasikan adalah tiket menawar Anda. Bid yang lebih tipis dari janji publik Anda sendiri ditolak sistem, bukan dinegosiasi ulang.',
    detail: 'Dibandingkan dalam rupiah terhadap harga OTR, bukan dalam persen.',
    status: 'live',
  },
  {
    icon: 'map',
    title: 'Lokasi dan reputasi',
    body: 'Area layanan, rating, dan kecepatan balas Anda akan ikut menentukan urutan lelang yang Anda lihat. Bagian ini belum aktif — hari ini pencocokan berhenti di dua dimensi di atas.',
    detail: 'Segera hadir. Belum memengaruhi lelang mana pun.',
    status: 'soon',
  },
]

/**
 * The profile-completeness nudge. Every line maps to a column a sales user can
 * actually fill and states the mechanical consequence of leaving it empty — not a
 * score. There is no completeness metric in the database, so the page must not
 * display one.
 */
export type ProfileTask = {
  label: string
  effect: string
  required: boolean
}

export const PROFILE_TASKS: readonly ProfileTask[] = [
  {
    label: 'Brand yang Anda pegang',
    effect: 'Menyaring lelang dan lead ke merek yang benar-benar Anda jual.',
    required: true,
  },
  {
    label: 'Penawaran per model: harga OTR dan diskon maksimum',
    effect: 'Tanpa ini Anda tidak bisa menawar sama sekali. Satu penawaran aktif untuk setiap model yang Anda incar.',
    required: true,
  },
  {
    label: 'Area layanan',
    effect: 'Disiapkan untuk pencocokan lokasi. Belum memengaruhi urutan lelang.',
    required: false,
  },
  {
    label: 'Verifikasi data dealer',
    effect: 'Memunculkan badge terverifikasi di kartu lelang dan profil publik Anda.',
    required: false,
  },
]

/**
 * Illustrative auction rows. Shape follows `SalesAuctionRow` in
 * `lib/auction/queries.ts` minus anything that query refuses to project: no
 * rival price, ever. `myRank` of null means the sales user has not bid yet.
 */
export type PreviewAuction = {
  brand: string
  model: string
  variant: string
  tierLabel: string
  /** Rupiah the customer is targeting. */
  targetPrice: number
  /** OTR price frozen onto the auction at creation. */
  listPrice: number
  bidderCount: number
  myRank: number | null
  closesIn: string
}

export const PREVIEW_AUCTIONS: readonly PreviewAuction[] = [
  {
    brand: 'Toyota',
    model: 'Fortuner',
    variant: '2.4 VRZ AT',
    tierLabel: 'SUV / MPV',
    targetPrice: 585_000_000,
    listPrice: 620_000_000,
    bidderCount: 4,
    myRank: 2,
    closesIn: '6 jam 12 menit',
  },
  {
    brand: 'BYD',
    model: 'Atto 3',
    variant: 'Superior',
    tierLabel: 'SUV / MPV',
    targetPrice: 468_000_000,
    listPrice: 505_000_000,
    bidderCount: 2,
    myRank: 1,
    closesIn: '21 jam 40 menit',
  },
  {
    brand: 'Honda',
    model: 'Brio',
    variant: 'RS CVT',
    tierLabel: 'City car',
    targetPrice: 232_000_000,
    listPrice: 248_000_000,
    bidderCount: 1,
    myRank: null,
    closesIn: '43 jam 5 menit',
  },
]

/**
 * Masked token-pool cards. Shape follows `MarketplaceLead` in
 * `lib/sales/queries.ts`, which selects no customer identity column at all. Name
 * and number are hidden here for the same reason they are hidden there.
 *
 * `reason` is the honest answer to "kenapa lead ini masih ada": the pool holds
 * only flagged requests and auctions that closed with no valid bid.
 */
export type PreviewLead = {
  brand: string
  model: string
  tierLabel: string
  targetPrice: number
  discountPercent: number
  timeframe: string
  tokenCost: number
  reason: string
  age: string
}

export const PREVIEW_LEADS: readonly PreviewLead[] = [
  {
    brand: 'Mitsubishi',
    model: 'Xpander',
    tierLabel: 'SUV / MPV',
    targetPrice: 268_000_000,
    discountPercent: 6.4,
    timeframe: 'Kurang dari 30 hari',
    tokenCost: 22,
    reason: 'Lelang tutup tanpa bid',
    age: '3 jam lalu',
  },
  {
    brand: 'Daihatsu',
    model: 'Ayla',
    tierLabel: 'City car',
    targetPrice: 152_000_000,
    discountPercent: 4.1,
    timeframe: 'Bulan ini',
    tokenCost: 8,
    reason: 'Lelang tutup tanpa bid',
    age: '9 jam lalu',
  },
  {
    brand: 'Hyundai',
    model: 'Palisade',
    tierLabel: 'Premium',
    targetPrice: 742_000_000,
    discountPercent: 21.8,
    timeframe: 'Belum pasti',
    tokenCost: 60,
    reason: 'Target di luar batas wajar',
    age: '1 hari lalu',
  },
]

export const PREMIUM_FEATURES: readonly string[] = [
  'Verified badge di kartu lelang dan profil publik',
  'Unlock token pool tanpa batas harian',
  'CRM penuh: pipeline, follow-up center, analitik',
  'Profil sales publik yang bisa ditemukan pembeli',
  'Statistik performa: response rate dan konversi',
  'Notifikasi lebih awal saat lelang brand Anda dibuka',
  'Bonus token berkala untuk akun aktif',
]

/** Reputation preview. Illustration — not a real account. */
export const PREVIEW_SALES = {
  name: 'Rizky Pratama',
  initials: 'RP',
  role: 'Toyota Specialist',
  dealer: 'Auto2000 Bekasi',
  rating: 4.8,
  reviews: 52,
  transactions: 143,
  responseRate: 96,
  responseMinutes: 4,
} as const

export const PREVIEW_PIPELINE: readonly { label: string; count: number }[] = [
  { label: 'Lead baru', count: 7 },
  { label: 'Dihubungi', count: 5 },
  { label: 'Negosiasi', count: 3 },
  { label: 'Menang', count: 2 },
  { label: 'Kalah', count: 2 },
]

export type Faq = {
  q: string
  a: string
}

export const FAQS: readonly Faq[] = [
  {
    q: 'Apa bedanya lelang dan token pool?',
    a: 'Lelang adalah jalur utamanya. Request dengan target harga yang masuk akal langsung dibuka sebagai lelang 48 jam, dan sales bersaing memberi diskon terdalam tanpa memakai token. Token pool berisi sisanya: request yang target harganya di luar batas wajar, dan lelang yang tutup tanpa satu bid valid. Lead di pool dibuka dengan token.',
  },
  {
    q: 'Berapa lama satu lelang berjalan?',
    a: '48 jam sejak request masuk. Bid terbaik yang datang di 5 menit terakhir memundurkan penutupan 5 menit, maksimal 6 kali — jadi ekor terpanjangnya 30 menit tambahan. Aturan ini ada supaya lelang dimenangkan harga terbaik, bukan jam yang paling akurat.',
  },
  {
    q: 'Apakah ikut lelang memotong token saya?',
    a: 'Tidak. Menawar gratis, dan pemenang juga membayar 0 token. Yang Anda pertaruhkan adalah margin: harga yang Anda tawarkan tersimpan permanen sebagai komitmen, dan itu buktinya kalau customer melapor harga tidak dihormati.',
  },
  {
    q: 'Kenapa saya belum melihat lelang apa pun?',
    a: 'Karena belum ada penawaran aktif dari Anda untuk brand dan model yang sedang dilelang. Lelang dicocokkan ke penawaran Anda, bukan ditampilkan semua lalu disaring. Isi penawaran per model — brand, harga OTR, dan diskon maksimum — lalu lelang model itu muncul.',
  },
  {
    q: 'Bisakah saya menawar lebih tipis dari diskon yang saya publikasikan?',
    a: 'Tidak, sistem menolaknya. Diskon maksimum yang Anda publikasikan adalah batas yang mengikat Anda sendiri. Kalau boleh dilanggar, katalog penawaran berubah jadi tempat memasang angka yang tidak diniatkan.',
  },
  {
    q: 'Berapa token untuk membuka satu lead di pool?',
    a: 'Tergantung tier mobilnya: 5–10 token untuk city car, 20–30 untuk SUV atau MPV, 50–100 untuk mobil premium. Biaya persisnya selalu tertulis di kartu lead sebelum Anda menekan unlock, dan admin bisa mengubah tarif per tier maupun per brand.',
  },
  {
    q: 'Apakah saya dapat token gratis?',
    a: '100 token saat pendaftaran, tanpa syarat dan tanpa kartu kredit. Setiap sales lain yang mendaftar lewat kode referral Anda menambah 30 token, maksimal 300 token per bulan. Akun gratis juga dibatasi 3 unlock pool per hari, reset pukul 00:00 WIB.',
  },
  {
    q: 'Bagaimana cara membeli token?',
    a: 'Lewat halaman Token di dashboard: pilih paket, bayar lewat payment gateway. Paket dan harganya tercantum di bagian Token halaman ini, dibaca dari sumber yang sama dengan layar top-up. Integrasi pembayaran sedang dikerjakan — sampai aktif, saldo gratis dan bonus referral tetap bisa dipakai penuh.',
  },
  {
    q: 'Apakah data customer aman?',
    a: 'Nama dan nomor WhatsApp customer hanya terbuka untuk satu sales: pemenang lelang, atau sales yang membuka lead itu dari pool. Sebelum itu kolom identitas tidak ikut dikirim ke layar siapa pun. Nomor customer terverifikasi lewat OTP, jadi Anda tidak menelepon nomor asal — dan menyalurkan data itu ke pihak lain berakibat penangguhan akun.',
  },
  {
    q: 'Apakah harus sales resmi dealer?',
    a: 'Ya. Autonomo.id hanya untuk sales resmi dealer. Anda bisa mendaftar dan langsung memakai saldo gratis, sementara badge terverifikasi diberikan setelah data dealer Anda ditinjau — pembeli perlu yakin sedang bicara dengan orang yang benar bisa menerbitkan SPK.',
  },
]
