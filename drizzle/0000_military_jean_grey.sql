CREATE TYPE "public"."car_tier" AS ENUM('low', 'mid', 'high');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('pending', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."ledger_reason" AS ENUM('freemium_grant', 'topup', 'unlock', 'referral', 'admin_adjustment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'claimed', 'closed', 'expired', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('customer', 'sales', 'admin');--> statement-breakpoint
CREATE TABLE "daily_unlock_quota" (
	"sales_id" uuid NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"sales_id" uuid NOT NULL,
	"tier" "car_tier" NOT NULL,
	"token_cost" integer NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "lead_status" DEFAULT 'pending' NOT NULL,
	"internal_notes" text,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_quota" (
	"sales_id" uuid NOT NULL,
	"month" text NOT NULL,
	"tokens_granted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"variant" text,
	"discount_wanted" numeric(5, 2) NOT NULL,
	"tier" "car_tier" NOT NULL,
	"purchase_timeframe" text,
	"notes" text,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"flagged_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"dealer_name" text,
	"city" text,
	"brands" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"verified_badge" boolean DEFAULT false NOT NULL,
	"premium_until" timestamp with time zone,
	"token_balance" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2),
	"transactions_won" integer DEFAULT 0 NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"area" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"ref_id" uuid,
	"idempotency_key" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top_discount" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"sales_id" uuid NOT NULL,
	"discount_percent" numeric(5, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unlock_pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "car_tier" NOT NULL,
	"token_cost" integer NOT NULL,
	"brand" text,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "role" NOT NULL,
	"phone" text NOT NULL,
	"full_name" text,
	"phone_verified_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_unlock_quota" ADD CONSTRAINT "daily_unlock_quota_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_quota" ADD CONSTRAINT "referral_quota_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD CONSTRAINT "sales_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ledger" ADD CONSTRAINT "token_ledger_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_discount" ADD CONSTRAINT "top_discount_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlock_pricing_rules" ADD CONSTRAINT "unlock_pricing_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_unlock_quota_key" ON "daily_unlock_quota" USING btree ("sales_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_request_sales_key" ON "leads" USING btree ("request_id","sales_id");--> statement-breakpoint
CREATE INDEX "leads_sales_status_idx" ON "leads" USING btree ("sales_id","status");--> statement-breakpoint
CREATE INDEX "leads_sales_unlocked_idx" ON "leads" USING btree ("sales_id","unlocked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_quota_key" ON "referral_quota" USING btree ("sales_id","month");--> statement-breakpoint
CREATE INDEX "requests_customer_idx" ON "requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "requests_status_created_idx" ON "requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "requests_brand_idx" ON "requests" USING btree ("brand");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_profile_referral_code_key" ON "sales_profile" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "sales_profile_referred_by_idx" ON "sales_profile" USING btree ("referred_by");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "token_ledger_idempotency_key" ON "token_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "token_ledger_sales_created_idx" ON "token_ledger" USING btree ("sales_id","created_at");--> statement-breakpoint
CREATE INDEX "token_ledger_reason_idx" ON "token_ledger" USING btree ("reason");--> statement-breakpoint
CREATE UNIQUE INDEX "top_discount_brand_sales_key" ON "top_discount" USING btree ("brand","sales_id");--> statement-breakpoint
CREATE INDEX "top_discount_rank_idx" ON "top_discount" USING btree ("brand","discount_percent");--> statement-breakpoint
CREATE INDEX "unlock_pricing_rules_lookup_idx" ON "unlock_pricing_rules" USING btree ("tier","brand","active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");