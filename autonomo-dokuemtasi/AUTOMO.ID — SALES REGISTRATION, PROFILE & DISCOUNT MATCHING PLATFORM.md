# AUTOMO.ID — SALES REGISTRATION, PROFILE & DISCOUNT MATCHING PLATFORM

Build a production-ready **Sales Registration & Onboarding Platform** for Automo.id.

The purpose of this experience is not only to register automotive sales representatives, but to collect structured sales information that can later be used by Automo.id to:

1. Verify the sales representative
2. Build a public sales profile
3. Understand which automotive brands/models the sales can sell
4. Understand the discount they can offer
5. Match customer requests with relevant sales
6. Rank the most relevant sales for each customer request
7. Allow sales to receive qualified leads

The entire experience should feel like a **professional automotive sales platform**, not a generic registration form.

---

# 1. CORE USER FLOW

The primary flow is:

Landing Page
→ Register as Sales
→ WhatsApp OTP
→ Sales Profile
→ Dealer Information
→ Brand & Vehicle Inventory
→ Discount Configuration
→ Coverage Area
→ Profile Verification
→ Dashboard
→ Matched Leads

The onboarding process should be divided into clear steps.

Use a progress indicator:

1. Account
2. Sales Profile
3. Dealer
4. Brand & Model
5. Discount
6. Coverage
7. Verification
8. Complete

Show:

**Step 4 of 8**

and a visual progress bar.

---

# 2. SALES LANDING PAGE

## Header

Logo:
**Automo.id**

Navigation:
- Cara Kerja
- Benefit Sales
- Cara Matching
- Token
- FAQ

Right side:

**Login**

Primary CTA:

**Daftar Sebagai Sales**

---

# 3. HERO SECTION

Headline:

**Dapatkan Customer yang Mencari Mobil Sesuai Penawaranmu.**

Alternative supporting headline:

**Masukkan stok, model, dan diskon yang kamu punya. Automo.id akan mencocokkanmu dengan customer yang sedang mencari mobil.**

Supporting copy:

**Tidak perlu lagi menunggu lead yang tidak jelas. Tampilkan penawaran terbaikmu dan temukan customer yang memiliki kebutuhan sesuai.**

Primary CTA:

**Daftar Sebagai Sales**

Secondary CTA:

**Lihat Cara Kerja**

Hero visual:

Create a modern dashboard preview showing:

Customer Request:

Toyota Fortuner
Target Discount:
Rp35.000.000

Matched Sales:

Budi Santoso
Toyota Specialist
Offer:
Rp40.000.000

Match Score:
**96% Match**

CTA:
**Lihat Lead**

---

# 4. EXPLAIN THE MATCHING SYSTEM

Create a section explaining the core value proposition.

Headline:

**Semakin Lengkap Profilmu, Semakin Akurat Matching Lead-mu.**

Explain that Automo.id matches customer requests with sales based on structured information.

Matching parameters:

### Brand

Example:
Toyota

### Model

Example:
Fortuner

### Variant

Example:
2.8 GR Sport

### Customer Target Discount

Example:
Rp35 Juta

### Sales Available Discount

Example:
Up to Rp40 Juta

### Location

Example:
Jakarta Selatan

### Purchase Timeline

Example:
< 30 Days

### Sales Performance

Example:
Rating 4.9
128 Successful Transactions

### Verification

Verified / Non-Verified

---

# 5. MATCHING VISUALIZATION

Create an interactive visual.

Customer:

**Toyota Fortuner**
Target Discount:
Rp35 Juta

↓

Automo.id Matching Engine

↓

Sales A:
Available Discount:
Rp40 Juta
Match:
96%

Sales B:
Available Discount:
Rp37 Juta
Match:
91%

Sales C:
Available Discount:
Rp35 Juta
Match:
87%

This should clearly communicate:

**Customer request → Matching Engine → Best Sales**

---

# 6. REGISTRATION CTA

Headline:

**Siap Mendapatkan Lead yang Lebih Relevan?**

Copy:

**Daftar gratis, lengkapi profil sales, masukkan penawaran diskonmu, dan mulai mendapatkan customer yang sesuai.**

CTA:

**Daftar Sekarang**

Secondary:

**Saya Sudah Terdaftar — Login**

---

# 7. REGISTRATION FLOW

When the user clicks "Daftar Sekarang":

Open registration flow.

## STEP 1 — ACCOUNT

Headline:

**Buat Akun Sales**

Fields:

Nama Lengkap
WhatsApp Number
Email

WhatsApp Number is required for OTP authentication.

CTA:

**Kirim OTP**

---

# 8. OTP VERIFICATION

Headline:

**Verifikasi Nomor WhatsApp**

Copy:

**Masukkan kode OTP yang kami kirim ke WhatsApp kamu.**

OTP input:

[ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ]

Options:

**Kirim ulang OTP**

After verification:

**Nomor WhatsApp berhasil diverifikasi.**

CTA:

**Lanjutkan**

---

# 9. STEP 2 — SALES PROFILE

Headline:

**Lengkapi Profil Sales Kamu**

Subheadline:

**Profil ini akan membantu customer mengenal dan mempercayai kamu.**

Fields:

### Profile Photo

Upload photo.

Requirements:
- JPG / PNG
- Professional sales photo
- Recommended square format

### Full Name

Example:
Budi Santoso

### Sales Position

Dropdown:
- Sales Consultant
- Sales Executive
- Sales Specialist
- Other

### Years of Experience

Dropdown:
- < 1 tahun
- 1–3 tahun
- 3–5 tahun
- 5–10 tahun
- >10 tahun

### Short Bio

Textarea.

Example:

**Sales Toyota berpengalaman dengan fokus SUV dan MPV area Jakarta Selatan.**

### WhatsApp Number

Automatically populated from verified account.

---

# 10. SALES PROFILE PREVIEW

While filling the form, show a live profile preview on desktop.

Example:

--------------------------------

[PHOTO]

**Budi Santoso**

Toyota Sales Specialist

✓ Verified WhatsApp

Jakarta Selatan

Experience:
8 Years

★★★★★ 4.9

128 Successful Transactions

Response Rate:
95%

--------------------------------

The preview updates automatically as the sales fills the form.

---

# 11. STEP 3 — DEALER INFORMATION

Headline:

**Kamu Berjualan di Dealer Mana?**

Fields:

### Dealer Name

Searchable dropdown.

### Dealer Branch

Example:

Toyota Auto2000
Jakarta Selatan

### Dealer Address

Address field.

### City

Dropdown.

### Province

Dropdown.

### Dealer Phone

Optional.

### Sales ID / Employee ID

Optional or required depending on verification policy.

### Dealer Verification Document

Upload:
- Sales ID
- Dealer ID
- Official sales document

Do not expose uploaded verification documents publicly.

Status:

**Verification Pending**

---

# 12. STEP 4 — AUTOMOTIVE BRAND

Headline:

**Mobil Apa yang Kamu Jual?**

Subheadline:

**Pilih brand dan model yang bisa kamu tawarkan kepada customer.**

Allow multiple brands only if the sales is legitimately authorized to sell them.

Brand selection:

Search brand.

Example:

Toyota
Honda
Mitsubishi
Daihatsu
Hyundai
BYD
Wuling
Suzuki
Nissan
Mazda
BMW
Mercedes-Benz
Other

Each selected brand becomes a card.

---

# 13. STEP 5 — MODEL & VARIANT

After selecting a brand:

Show:

**Toyota**

Models:

- Avanza
- Veloz
- Innova
- Fortuner
- Rush
- Raize
- Yaris
- Corolla Cross
- Alphard

Allow selecting multiple models.

For each model, allow variant selection.

Example:

Toyota Fortuner

Variants:

2.4 G
2.8 VRZ
2.8 GR Sport

---

# 14. DISCOUNT INVENTORY

This is one of the most important sections.

Headline:

**Berapa Diskon yang Bisa Kamu Berikan?**

Subheadline:

**Masukkan penawaran terbaik yang saat ini bisa kamu berikan untuk setiap model. Data ini digunakan untuk mencocokkanmu dengan customer yang mencari diskon tertentu.**

For every model/variant, create a discount configuration card.

Example:

### Toyota Fortuner 2.8 GR Sport

Current OTR Price:
Rp850.000.000

Available Discount:

[ Rp 40.000.000 ]

Discount Type:

○ Fixed Amount
○ Percentage

Maximum Discount:

Rp40.000.000

Minimum Negotiable Discount:

Rp30.000.000

Promo Period:

Start Date
End Date

Additional Benefits:

☐ Free Service
☐ Free Insurance
☐ Free Accessories
☐ Free Ceramic Coating
☐ Other

Notes:

Textarea.

Example:

**Promo berlaku sampai akhir bulan dan dapat berubah mengikuti program dealer.**

---

# 15. DISCOUNT STRUCTURE

The system must distinguish between:

### Published Discount

The discount displayed to customer.

Example:

**Up to Rp40 Juta**

### Minimum Negotiable Discount

The lowest discount the sales is willing/authorized to offer.

Example:

Rp30 Juta

### Special Campaign Discount

Special temporary discount.

Example:

**GIIAS Promo — Up to Rp50 Juta**

### Additional Benefits

Examples:

Free service
Free insurance
Free accessories
Free tint
Free coating

Do not expose internal negotiation information to customers.

The public-facing profile should only display approved/public discount information.

---

# 16. DISCOUNT MATCHING LOGIC

Create a matching-ready data structure.

For each sales offer store:

Brand
Model
Variant
Price
Maximum Discount
Minimum Discount
Discount Type
Campaign
Campaign Start
Campaign End
Location
Dealer
Sales ID
Verification Status

For each customer request store:

Brand
Model
Variant
Target Discount
Budget
Location
Purchase Timeline

The matching system should calculate a **Match Score**.

Example:

Customer:

Toyota Fortuner
Target Discount:
Rp35 Juta

Sales A:

Maximum Discount:
Rp40 Juta

Match Score:
96%

Sales B:

Maximum Discount:
Rp35 Juta

Match Score:
90%

Sales C:

Maximum Discount:
Rp25 Juta

Match Score:
62%

---

# 17. MATCHING SCORE UI

Create a visual score component.

Example:

**96% Match**

Breakdown:

Vehicle Match
100%

Discount Match
100%

Location Match
95%

Availability
100%

Sales Reputation
90%

Purchase Timing
95%

The score should help prioritize which sales should receive a lead.

---

# 18. DISCOUNT MANAGEMENT DASHBOARD

After registration, sales should have a dedicated menu:

**My Offers**

Dashboard structure:

My Brands
My Models
Active Promotions
Expired Promotions
Discount Performance

Example:

Toyota
3 Active Models

Fortuner
Up to Rp40 Juta

Innova Zenix
Up to Rp35 Juta

Avanza
Up to Rp25 Juta

Each offer has:

Status:
Active / Expired / Draft

CTA:
**Edit**

---

# 19. ADD NEW OFFER

Large CTA:

**+ Tambah Penawaran**

Flow:

Select Brand
→ Select Model
→ Select Variant
→ Enter Discount
→ Add Benefits
→ Set Promotion Period
→ Review
→ Publish

Before publishing:

Show preview:

--------------------------------

Toyota Fortuner 2.8 GR Sport

**Diskon hingga Rp40 Juta**

✓ Free Service
✓ Free Accessories

Available until:
31 August 2026

Sales:
Budi Santoso
✓ Verified

--------------------------------

CTA:

**Publish Penawaran**

---

# 20. CUSTOMER REQUEST MATCHING NOTIFICATION

When a new customer request matches the sales profile, show:

### NEW MATCHED LEAD

**Toyota Fortuner**

Customer Target:
Rp35 Juta

Your Offer:
Up to Rp40 Juta

Match Score:

**96%**

Purchase Timeline:

<30 Days

Unlock Cost:

25 Token

CTA:

**Unlock Lead**

Secondary:

**View Details**

---

# 21. SALES DASHBOARD

After onboarding, redirect sales to:

**Sales Dashboard**

Top metrics:

### Matching Leads
24

### Hot Leads
8

### Active Offers
12

### Token Balance
530

### Conversion Rate
8.4%

### Successful Transactions
128

Main section:

**Customer yang Cocok dengan Penawaranmu**

Cards:

Customer Request
Vehicle
Target Discount
Your Discount
Match Score
Purchase Timeline
Unlock Cost

CTA:

**Unlock Lead**

---

# 22. SALES PROFILE PUBLIC PAGE

Create a public-facing profile.

URL structure:

/sales/[sales-slug]

Example:

**Budi Santoso**

✓ Verified Sales

Toyota Specialist

Auto2000 Jakarta Selatan

★★★★★ 4.9

128 Successful Transactions

95% Response Rate

Average Response:
<5 minutes

---

## ACTIVE OFFERS

Toyota Fortuner
**Up to Rp40 Juta Discount**

Toyota Innova Zenix
**Up to Rp35 Juta Discount**

Toyota Avanza
**Up to Rp25 Juta Discount**

CTA:

**Request Penawaran**

---

# 23. VERIFICATION SYSTEM

Show profile verification status.

Statuses:

### Pending

**Verification sedang diproses**

### Verified

✓ **Verified Sales**

### Rejected

**Data perlu diperbaiki**

Allow sales to resubmit documents.

The Verified Badge should be highly visible on the public sales profile.

---

# 24. ONBOARDING COMPLETION SCORE

Create:

**Profile Completion**

85%

Checklist:

✓ WhatsApp Verified
✓ Profile Photo
✓ Dealer Information
✓ Brand Selected
✓ Model Selected
✓ Discount Added
✓ Coverage Area
○ Verification Completed

CTA:

**Lengkapi Profil**

Explain:

**Profil yang lengkap membantu Automo.id memberikan matching lead yang lebih relevan.**

---

# 25. COVERAGE AREA

Headline:

**Di Area Mana Kamu Melayani Customer?**

Allow:

Province
City
District

Example:

Jawa Barat
Bogor
Depok
Bekasi

Allow multiple areas.

Option:

**Saya melayani customer secara nasional**

This data should be used as one of the matching parameters.

---

# 26. CUSTOMER MATCHING PRIORITY

The system should prioritize sales based on:

1. Exact brand match
2. Exact model match
3. Variant match
4. Discount competitiveness
5. Location / service area
6. Purchase timeline
7. Sales verification
8. Sales rating
9. Successful transaction history
10. Response performance

Do not expose the entire algorithm to users.

Show only the resulting:

**Match Score**

---

# 27. IMPORTANT UX RULE

The onboarding process must not feel like a long registration form.

Use:

- Step-by-step wizard
- Progress indicator
- Autosave
- Continue later
- Smart defaults
- Searchable dropdown
- Vehicle database
- Dynamic fields
- Live profile preview

For example:

After selecting:

Toyota → Fortuner

Automatically load available variants.

Do not make sales manually type vehicle names if the vehicle exists in the system database.

---

# 28. MOBILE EXPERIENCE

The sales registration flow must be fully responsive.

Mobile onboarding:

Step indicator at top.

One section per screen.

Large input controls.

Sticky bottom CTA:

**Lanjutkan**

For discount input:

Use numeric keyboard.

Example:

Diskon Maksimal

Rp [40.000.000]

Show automatically:

**≈ 4.7%**

if the OTR price is available.

---

# 29. FINAL ONBOARDING SCREEN

After completion:

Headline:

**Profil Sales Kamu Sudah Siap.**

Supporting copy:

**Automo.id sekarang dapat mencocokkan profil dan penawaranmu dengan customer yang sedang mencari mobil.**

Show:

Profile Completion:
100%

Brands:
Toyota

Active Offers:
6

Coverage:
Jakarta Selatan

Verification:
Pending / Verified

CTA:

**Lihat Customer yang Cocok**

Secondary:

**Lihat Profil Saya**

---

# 30. IMPORTANT BUSINESS LOGIC

The platform must treat discount information as dynamic data.

Sales can:

Create Offer
Edit Offer
Pause Offer
Delete Offer
Set Promotion Period
Update Discount
Add Promotional Benefits

When an offer expires:

Automatically change status:

**Expired**

Expired offers must not be used for active customer matching.

When a discount is updated:

The matching engine should use the latest approved discount.

When a sales profile is not verified:

Do not give the same trust ranking as verified sales.

When a sales is verified:

Show:

✓ Verified Sales

on the public profile and matching result.

---

# 31. SECURITY & DATA PRIVACY

Never expose:

- Customer WhatsApp
- Customer personal information
- Internal sales discount floor
- Dealer internal information
- Verification documents

before the appropriate authorization/unlock flow.

Sales should only see customer contact information after successfully unlocking the lead using Token.

This follows the Automo.id lead-unlock model where customer data remains hidden until the sales uses the required credit/token. 

---

# 32. FINAL PRODUCT OBJECTIVE

The entire system should create this business loop:

SALES REGISTRATION
↓
COMPLETE PROFILE
↓
SELECT BRAND & MODEL
↓
ENTER AVAILABLE DISCOUNT
↓
SET PROMOTION
↓
AUTOMO.ID MATCHING ENGINE
↓
CUSTOMER REQUEST
↓
MATCH SCORE
↓
SALES RECEIVES RELEVANT LEAD
↓
UNLOCK WITH TOKEN
↓
WHATSAPP CUSTOMER
↓
NEGOTIATION
↓
CLOSING
↓
TRANSACTION RECORDED
↓
SALES REPUTATION INCREASES

The core product message should be:

**"Masukkan penawaranmu. Kami carikan customer yang sesuai."**

The platform should make the sales feel that Automo.id is not merely a lead marketplace, but a **lead acquisition engine powered by their actual vehicle availability, discount capability, location, and sales reputation.**