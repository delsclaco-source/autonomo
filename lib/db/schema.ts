import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
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
export const leadStatusEnum = pgEnum('lead_status', [
  'pending',
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
    dealerName: text('dealer_name'),
    city: text('city'),
    /** Brands this sales user represents, e.g. {Toyota,Daihatsu}. */
    brands: text('brands').array().notNull().default(sql`ARRAY[]::text[]`),
    verifiedBadge: boolean('verified_badge').notNull().default(false),
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
    index('sales_profile_referred_by_idx').on(t.referredBy),
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
    /** Discount the customer is asking for, in percent. Server-validated. */
    discountWanted: numeric('discount_wanted', { precision: 5, scale: 2 }).notNull(),
    /** Tier drives unlock cost; resolved server-side from brand/model, not user input. */
    tier: carTierEnum('tier').notNull(),
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
    closedAt: timestamp('closed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One sales user pays for a given request at most once. This is the DB-level
    // backstop against double-spend, independent of the application lock.
    uniqueIndex('leads_request_sales_key').on(t.requestId, t.salesId),
    index('leads_sales_status_idx').on(t.salesId, t.status),
    index('leads_sales_unlocked_idx').on(t.salesId, t.unlockedAt),
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
}))

export const salesProfileRelations = relations(salesProfile, ({ one }) => ({
  user: one(users, { fields: [salesProfile.userId], references: [users.id] }),
  referrer: one(users, { fields: [salesProfile.referredBy], references: [users.id] }),
}))

export const requestsRelations = relations(requests, ({ one, many }) => ({
  customer: one(users, { fields: [requests.customerId], references: [users.id] }),
  leads: many(leads),
}))

export const leadsRelations = relations(leads, ({ one }) => ({
  request: one(requests, { fields: [leads.requestId], references: [requests.id] }),
  sales: one(users, { fields: [leads.salesId], references: [users.id] }),
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
