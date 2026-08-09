import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Autonomo.id database schema.
 *
 * Token accounting is the critical invariant here: a sales user's balance is
 * never stored as a mutable column that code increments. It is derived from the
 * append-only `token_ledger`, and `sales_profile.token_balance` is a cached
 * materialisation updated only inside the same transaction that inserts the
 * ledger row. That way a lost update can be detected (balance != sum of ledger)
 * rather than silently granting free unlocks.
 */

export const roleEnum = pgEnum('role', ['customer', 'sales', 'admin'])
export const carTierEnum = pgEnum('car_tier', ['low', 'mid', 'high'])
export const requestStatusEnum = pgEnum('request_status', [
  'open',
  'claimed',
  'closed',
  'expired',
  'flagged',
])
/**
 * Lead pipeline. `contacted` sits between `pending` and `negotiation` because the
 * CRM pipeline distinguishes "paid for, not yet reached out" from "in active
 * price talks" — without it the Kanban board collapses two very different
 * follow-up states into one column.
 */
export const leadStatusEnum = pgEnum('lead_status', [
  'pending',
  'contacted',
  'negotiation',
  'won',
  'lost',
])
export const ledgerReasonEnum = pgEnum('ledger_reason', [
  'freemium_grant',
  'topup',
  'unlock',
  'referral',
  'admin_adjustment',
  'refund',
])

/** Why a lead was lost. Feeds analytics and, later, lead scoring. */
export const lostReasonEnum = pgEnum('lost_reason', [
  'price',
  'competitor',
  'no_response',
  'postponed',
  'wrong_lead',
  'other',
])

/**
 * Sales verification. Replaces a boolean badge: a rejected applicant needs to be
 * told what to fix and allowed to resubmit, which two states cannot express.
 */
export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',
  'verified',
  'rejected',
])

/** How a sales user expressed their discount when creating the offer. */
export const discountTypeEnum = pgEnum('discount_type', ['fixed_amount', 'percentage'])

export const offerStatusEnum = pgEnum('offer_status', [
  'draft',
  'active',
  'paused',
  'expired',
])

/** Non-cash sweeteners attached to an offer. */
export const offerBenefitEnum = pgEnum('offer_benefit', [
  'free_service',
  'free_insurance',
  'free_accessories',
  'free_coating',
  'free_tint',
  'other',
])

/** Verification document kinds. Files are private, never served publicly. */
export const salesDocumentKindEnum = pgEnum('sales_document_kind', [
  'id_card',
  'employee_id',
  'business_card',
  'dealer_letter',
  'other',
])

export const notificationKindEnum = pgEnum('notification_kind', [
  'lead_matched',
  'customer_replied',
  'follow_up_due',
  'transaction_won',
  'topup_success',
  'referral_bonus',
  'premium_expiring',
  'verification_update',
])

/** Activity timeline entries for a lead. */
export const leadActivityKindEnum = pgEnum('lead_activity_kind', [
  'unlocked',
  'contacted',
  'status_changed',
  'note_added',
  'follow_up_set',
  'won',
  'lost',
])

// ---------------------------------------------------------------------------
// Users & profiles
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: roleEnum('role').notNull(),
    /** E.164 without '+', e.g. 6281234567890. Unique across all roles. */
    phone: text('phone').notNull(),
    fullName: text('full_name'),
    /**
     * Optional. WhatsApp is the identity here, not email — a sales user who never
     * gives one must still be able to register (registration step 1 asks, does
     * not require). Not unique: two family members sharing an inbox is ordinary.
     */
    email: text('email'),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_phone_key').on(t.phone), index('users_role_idx').on(t.role)],
)

export const salesProfile = pgTable(
  'sales_profile',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    dealerId: uuid('dealer_id').references(() => dealers.id, { onDelete: 'set null' }),
    /**
     * Free-text dealer name, kept alongside `dealerId`. A sales user at a branch
     * not yet in `dealers` must still finish onboarding; admin reconciles later.
     */
    dealerName: text('dealer_name'),
    dealerBranch: text('dealer_branch'),
    dealerAddress: text('dealer_address'),
    dealerPhone: text('dealer_phone'),
    employeeId: text('employee_id'),
    city: text('city'),
    province: text('province'),
    /** Brands this sales user represents, e.g. {Toyota,Daihatsu}. */
    brands: text('brands').array().notNull().default(sql`ARRAY[]::text[]`),
    photoUrl: text('photo_url'),
    position: text('position'),
    experienceYears: integer('experience_years'),
    bio: text('bio'),
    /**
     * Public profile URL segment. Nullable until onboarding assigns one — a
     * half-finished profile must not occupy a slug. Unique when present.
     */
    slug: text('slug'),
    /**
     * Verification lifecycle. `verification_note` carries the reject reason so the
     * applicant knows what to resubmit; a boolean badge could not say that.
     */
    verificationStatus: verificationStatusEnum('verification_status')
      .notNull()
      .default('pending'),
    verificationNote: text('verification_note'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** Serves every province; makes `sales_coverage` rows unnecessary. */
    nationwide: boolean('nationwide').notNull().default(false),
    /** Share of unlocked leads this user contacted, 0–100. Recomputed, not authored. */
    responseRate: numeric('response_rate', { precision: 5, scale: 2 }),
    avgResponseMinutes: integer('avg_response_minutes'),
    premiumUntil: timestamp('premium_until', { withTimezone: true }),
    /**
     * Cached sum of token_ledger.delta for this user. Only ever written inside
     * the same transaction as the ledger insert, under SELECT ... FOR UPDATE.
     * Never trust this without the ledger — it is a cache, not the source.
     */
    tokenBalance: integer('token_balance').notNull().default(0),
    rating: numeric('rating', { precision: 3, scale: 2 }),
    transactionsWon: integer('transactions_won').notNull().default(0),
    /** Short code shared with prospects; grants referral bonus on signup. */
    referralCode: text('referral_code').notNull(),
    referredBy: uuid('referred_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sales_profile_referral_code_key').on(t.referralCode),
    // Partial-by-nature: PostgreSQL treats NULLs as distinct, so profiles without
    // a slug yet do not collide with each other.
    uniqueIndex('sales_profile_slug_key').on(t.slug),
    index('sales_profile_referred_by_idx').on(t.referredBy),
    index('sales_profile_verification_idx').on(t.verificationStatus),
  ],
)

// ---------------------------------------------------------------------------
// Requests & leads
// ---------------------------------------------------------------------------

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    variant: text('variant'),
    /**
     * List price from the catalogue at submission time, in rupiah. Frozen here so a
     * later catalogue price change cannot retroactively alter what discount this
     * request was asking for.
     */
    listPrice: bigint('list_price', { mode: 'number' }),
    /**
     * What the customer is willing to pay, in rupiah. This is the number they
     * actually typed — `discount_wanted` is derived from it. Stored because the
     * matching engine compares rupiah against `sales_offers.max_discount` in
     * rupiah; a percentage cannot be compared across models without the OTR.
     */
    targetPrice: bigint('target_price', { mode: 'number' }),
    /** Discount the customer is asking for, in percent. Server-derived, never client input. */
    discountWanted: numeric('discount_wanted', { precision: 5, scale: 2 }).notNull(),
    /** Tier drives unlock cost; resolved server-side from brand/model, not user input. */
    tier: carTierEnum('tier').notNull(),
    /** Location parameters for matching against `sales_coverage`. */
    city: text('city'),
    province: text('province'),
    purchaseTimeframe: text('purchase_timeframe'),
    notes: text('notes'),
    status: requestStatusEnum('status').notNull().default('open'),
    /** Set when discount_wanted exceeds the fraud threshold (see CLAUDE.md § 7). */
    flaggedReason: text('flagged_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('requests_customer_idx').on(t.customerId),
    index('requests_status_created_idx').on(t.status, t.createdAt),
    index('requests_brand_idx').on(t.brand),
  ],
)

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Tier and cost are frozen at unlock time so later pricing changes don't rewrite history. */
    tier: carTierEnum('tier').notNull(),
    tokenCost: integer('token_cost').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
    status: leadStatusEnum('status').notNull().default('pending'),
    internalNotes: text('internal_notes'),
    /** Set the first time the sales user marks the lead `contacted`. Feeds `response_rate`. */
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    /** Drives the Follow-Up Center buckets: overdue / due today / upcoming. */
    nextFollowUp: timestamp('next_follow_up', { withTimezone: true }),
    /** Only meaningful when `status = 'lost'`; feeds loss analytics. */
    lostReason: lostReasonEnum('lost_reason'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One sales user pays for a given request at most once. This is the DB-level
    // backstop against double-spend, independent of the application lock.
    uniqueIndex('leads_request_sales_key').on(t.requestId, t.salesId),
    index('leads_sales_status_idx').on(t.salesId, t.status),
    index('leads_sales_unlocked_idx').on(t.salesId, t.unlockedAt),
    // Follow-Up Center reads "my leads, soonest due first"; the index matches that shape.
    index('leads_follow_up_idx').on(t.salesId, t.nextFollowUp),
  ],
)

// ---------------------------------------------------------------------------
// Dealers
// ---------------------------------------------------------------------------

/**
 * Dealer directory backing the searchable dropdown in sales onboarding step 3.
 *
 * Kept separate from the free-text `sales_profile.dealer_name` on purpose: a sales
 * user at a branch that is not in this table must still be able to finish
 * onboarding, so the reference is nullable and admin reconciles later.
 */
export const dealers = pgTable(
  'dealers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    branch: text('branch'),
    address: text('address'),
    city: text('city'),
    province: text('province'),
    phone: text('phone'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Same brand name recurs across branches, so neither column is unique alone.
    uniqueIndex('dealers_name_branch_key').on(t.name, t.branch),
    index('dealers_city_idx').on(t.city),
  ],
)

// ---------------------------------------------------------------------------
// Token ledger — append-only source of truth for all balance movement
// ---------------------------------------------------------------------------

export const tokenLedger = pgTable(
  'token_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Signed: negative for unlock, positive for topup/referral/grant. */
    delta: integer('delta').notNull(),
    /** Balance after applying this row, for audit without replaying the whole ledger. */
    balanceAfter: integer('balance_after').notNull(),
    reason: ledgerReasonEnum('reason').notNull(),
    /** Points at leads.id, payments.id, or the referred user id depending on reason. */
    refId: uuid('ref_id'),
    /**
     * Idempotency guard. Payment webhooks retry; without a unique key a retry
     * would credit tokens twice. Format: `<provider>:<event_id>` or `unlock:<lead_id>`.
     */
    idempotencyKey: text('idempotency_key'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('token_ledger_idempotency_key').on(t.idempotencyKey),
    index('token_ledger_sales_created_idx').on(t.salesId, t.createdAt),
    index('token_ledger_reason_idx').on(t.reason),
  ],
)

// ---------------------------------------------------------------------------
// Pricing rule engine — admin-configurable, never hardcoded in the frontend
// ---------------------------------------------------------------------------

export const unlockPricingRules = pgTable(
  'unlock_pricing_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tier: carTierEnum('tier').notNull(),
    tokenCost: integer('token_cost').notNull(),
    /** Optional narrowing: a rule for a specific brand overrides the tier default. */
    brand: text('brand'),
    active: boolean('active').notNull().default(true),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('unlock_pricing_rules_lookup_idx').on(t.tier, t.brand, t.active)],
)

/**
 * Per-day unlock counter for the freemium cap (3 unlocks/day).
 *
 * Stored rather than derived so the cap check is a single indexed row read inside
 * the unlock transaction. `day` is a date string in Asia/Jakarta — the reset
 * boundary customers and sales actually experience.
 */
export const dailyUnlockQuota = pgTable(
  'daily_unlock_quota',
  {
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [uniqueIndex('daily_unlock_quota_key').on(t.salesId, t.day)],
)

/**
 * Monthly referral bonus counter, capped at 300 tokens/month per CLAUDE.md § 2.
 * `month` is `YYYY-MM` in Asia/Jakarta.
 */
export const referralQuota = pgTable(
  'referral_quota',
  {
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    tokensGranted: integer('tokens_granted').notNull().default(0),
  },
  (t) => [uniqueIndex('referral_quota_key').on(t.salesId, t.month)],
)

// ---------------------------------------------------------------------------
// Top discount ranking source
// ---------------------------------------------------------------------------

export const topDiscount = pgTable(
  'top_discount',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brand: text('brand').notNull(),
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('top_discount_brand_sales_key').on(t.brand, t.salesId),
    // Ranking query orders by discount within a brand; index matches that shape.
    index('top_discount_rank_idx').on(t.brand, t.discountPercent),
  ],
)

// ---------------------------------------------------------------------------
// Discount inventory — what a sales user offers, and to whom
// ---------------------------------------------------------------------------

/**
 * A sales user's standing offer on one brand/model/variant.
 *
 * The matching engine compares a customer's `requests.target_price` against
 * `max_discount` here, which is why both sides store rupiah.
 *
 * `min_discount` is the floor the sales user will still accept. It is internal
 * negotiating position and must never appear in a customer-facing response — only
 * `max_discount` is public. Stated as an invariant in CLAUDE.md and PLAN.md § 2.3.
 */
export const salesOffers = pgTable(
  'sales_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    variant: text('variant'),
    /** On-the-road price this offer is quoted against, in rupiah. */
    otrPrice: bigint('otr_price', { mode: 'number' }),
    /** Best discount advertised, in rupiah. Public. */
    maxDiscount: bigint('max_discount', { mode: 'number' }).notNull(),
    /** Internal floor, in rupiah. NEVER serialised to a customer response. */
    minDiscount: bigint('min_discount', { mode: 'number' }),
    /**
     * How the sales user entered it. Both forms are normalised to rupiah on write
     * so matching never has to branch on this; kept to render the input back the
     * way it was typed.
     */
    discountType: discountTypeEnum('discount_type').notNull().default('fixed_amount'),
    campaignName: text('campaign_name'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    /** Past this instant a daily cron flips `status` to `expired`. */
    endsAt: timestamp('ends_at', { withTimezone: true }),
    note: text('note'),
    status: offerStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sales_offers_match_idx').on(t.brand, t.model, t.status),
    index('sales_offers_sales_idx').on(t.salesId, t.status),
    // The expiry sweep scans active offers by end date.
    index('sales_offers_expiry_idx').on(t.status, t.endsAt),
  ],
)

/** Non-cash sweeteners attached to an offer. Public — part of the pitch. */
export const offerBenefits = pgTable(
  'offer_benefits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => salesOffers.id, { onDelete: 'cascade' }),
    benefit: offerBenefitEnum('benefit').notNull(),
    /** Free text detail, e.g. "servis gratis 4× / 50.000 km". Required when benefit is `other`. */
    note: text('note'),
  },
  (t) => [
    index('offer_benefits_offer_idx').on(t.offerId),
    uniqueIndex('offer_benefits_offer_benefit_key').on(t.offerId, t.benefit),
  ],
)

/**
 * Where a sales user can actually deliver.
 *
 * A row per area served. `district` is optional — most sales cover a whole city.
 * A profile with `nationwide = true` needs no rows here at all; the matcher short
 * circuits on the flag rather than requiring 38 province rows.
 */
export const salesCoverage = pgTable(
  'sales_coverage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    province: text('province').notNull(),
    city: text('city'),
    district: text('district'),
  },
  (t) => [
    index('sales_coverage_sales_idx').on(t.salesId),
    // Matching asks "who covers this city?"; province leads for the city-less case.
    index('sales_coverage_area_idx').on(t.province, t.city),
  ],
)

/**
 * Verification documents uploaded during onboarding.
 *
 * `storagePath` points at private object storage. These rows are for the admin
 * verification queue only — no customer-facing or sales-facing query may select
 * them, and the path must never be turned into a public URL.
 */
export const salesDocuments = pgTable(
  'sales_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesId: uuid('sales_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: salesDocumentKindEnum('kind').notNull(),
    storagePath: text('storage_path').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sales_documents_sales_idx').on(t.salesId)],
)

// ---------------------------------------------------------------------------
// Notifications & activity
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    /**
     * Kind-specific detail (lead id, amount, offer id). Deliberately loose: the
     * shape differs per kind and a column per kind would be mostly nulls. Never
     * put a customer phone number in here — the unlock gate does not apply to it.
     */
    payload: jsonb('payload'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The bell reads "my newest first"; the unread count filters on read_at IS NULL.
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    index('notifications_unread_idx').on(t.userId, t.readAt),
  ],
)

/**
 * Append-only activity timeline for a lead (CRM document § 6).
 *
 * Written alongside every status change rather than reconstructed from the lead
 * row, because a lead row only remembers its current state — "negotiation on
 * Tuesday, lost on Friday" is not recoverable from it.
 */
export const leadActivities = pgTable(
  'lead_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    kind: leadActivityKindEnum('kind').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lead_activities_lead_created_idx').on(t.leadId, t.createdAt)],
)

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Server-side session records. The cookie carries only an opaque id; role and
 * identity are re-read from here on every request so a stale or forged cookie
 * cannot assert a role. Cookies are scoped per subdomain (no SSO) — see
 * CLAUDE.md § Auth & session.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Which subdomain issued this session; a sales session is invalid on admin. */
    area: text('area').notNull(),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  salesProfile: one(salesProfile, {
    fields: [users.id],
    references: [salesProfile.userId],
  }),
  requests: many(requests),
  leads: many(leads),
  ledger: many(tokenLedger),
  sessions: many(sessions),
  offers: many(salesOffers),
  coverage: many(salesCoverage),
  documents: many(salesDocuments),
  notifications: many(notifications),
}))

export const salesProfileRelations = relations(salesProfile, ({ one }) => ({
  user: one(users, { fields: [salesProfile.userId], references: [users.id] }),
  referrer: one(users, { fields: [salesProfile.referredBy], references: [users.id] }),
  dealer: one(dealers, { fields: [salesProfile.dealerId], references: [dealers.id] }),
}))

export const dealersRelations = relations(dealers, ({ many }) => ({
  salesProfiles: many(salesProfile),
}))

export const salesOffersRelations = relations(salesOffers, ({ one, many }) => ({
  sales: one(users, { fields: [salesOffers.salesId], references: [users.id] }),
  benefits: many(offerBenefits),
}))

export const offerBenefitsRelations = relations(offerBenefits, ({ one }) => ({
  offer: one(salesOffers, {
    fields: [offerBenefits.offerId],
    references: [salesOffers.id],
  }),
}))

export const salesCoverageRelations = relations(salesCoverage, ({ one }) => ({
  sales: one(users, { fields: [salesCoverage.salesId], references: [users.id] }),
}))

export const salesDocumentsRelations = relations(salesDocuments, ({ one }) => ({
  sales: one(users, { fields: [salesDocuments.salesId], references: [users.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, { fields: [leadActivities.leadId], references: [leads.id] }),
}))

export const requestsRelations = relations(requests, ({ one, many }) => ({
  customer: one(users, { fields: [requests.customerId], references: [users.id] }),
  leads: many(leads),
}))

export const leadsRelations = relations(leads, ({ one, many }) => ({
  request: one(requests, { fields: [leads.requestId], references: [requests.id] }),
  sales: one(users, { fields: [leads.salesId], references: [users.id] }),
  activities: many(leadActivities),
}))

export const tokenLedgerRelations = relations(tokenLedger, ({ one }) => ({
  sales: one(users, { fields: [tokenLedger.salesId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type CarTier = (typeof carTierEnum.enumValues)[number]
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number]
export type SalesProfile = typeof salesProfile.$inferSelect
export type Request = typeof requests.$inferSelect
export type Lead = typeof leads.$inferSelect
export type TokenLedgerEntry = typeof tokenLedger.$inferSelect
export type UnlockPricingRule = typeof unlockPricingRules.$inferSelect
export type Session = typeof sessions.$inferSelect

export type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number]
export type LostReason = (typeof lostReasonEnum.enumValues)[number]
export type OfferStatus = (typeof offerStatusEnum.enumValues)[number]
export type OfferBenefitKind = (typeof offerBenefitEnum.enumValues)[number]
export type DiscountType = (typeof discountTypeEnum.enumValues)[number]
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number]
export type LeadActivityKind = (typeof leadActivityKindEnum.enumValues)[number]
export type SalesDocumentKind = (typeof salesDocumentKindEnum.enumValues)[number]

export type Dealer = typeof dealers.$inferSelect
export type NewDealer = typeof dealers.$inferInsert
export type SalesOffer = typeof salesOffers.$inferSelect
export type NewSalesOffer = typeof salesOffers.$inferInsert
export type OfferBenefit = typeof offerBenefits.$inferSelect
export type SalesCoverage = typeof salesCoverage.$inferSelect
export type SalesDocument = typeof salesDocuments.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type LeadActivity = typeof leadActivities.$inferSelect

/**
 * Customer-safe projection of an offer. `minDiscount` is absent by construction,
 * not filtered — a filter can be removed by accident, a type that never had the
 * field cannot leak it. Use this as the return type of any query that feeds a
 * customer-facing response (PLAN.md § 2.3).
 */
export type PublicSalesOffer = Omit<SalesOffer, 'minDiscount' | 'note'>
