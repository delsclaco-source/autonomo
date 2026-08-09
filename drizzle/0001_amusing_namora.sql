CREATE TYPE "public"."discount_type" AS ENUM('fixed_amount', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."lead_activity_kind" AS ENUM('unlocked', 'contacted', 'status_changed', 'note_added', 'follow_up_set', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."lost_reason" AS ENUM('price', 'competitor', 'no_response', 'postponed', 'wrong_lead', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('lead_matched', 'customer_replied', 'follow_up_due', 'transaction_won', 'topup_success', 'referral_bonus', 'premium_expiring', 'verification_update');--> statement-breakpoint
CREATE TYPE "public"."offer_benefit" AS ENUM('free_service', 'free_insurance', 'free_accessories', 'free_coating', 'free_tint', 'other');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('draft', 'active', 'paused', 'expired');--> statement-breakpoint
CREATE TYPE "public"."sales_document_kind" AS ENUM('id_card', 'employee_id', 'business_card', 'dealer_letter', 'other');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE 'contacted' BEFORE 'negotiation';--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"branch" text,
	"address" text,
	"city" text,
	"province" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"kind" "lead_activity_kind" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"benefit" "offer_benefit" NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "sales_coverage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_id" uuid NOT NULL,
	"province" text NOT NULL,
	"city" text,
	"district" text
);
--> statement-breakpoint
CREATE TABLE "sales_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_id" uuid NOT NULL,
	"kind" "sales_document_kind" NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"variant" text,
	"otr_price" bigint,
	"max_discount" bigint NOT NULL,
	"min_discount" bigint,
	"discount_type" "discount_type" DEFAULT 'fixed_amount' NOT NULL,
	"campaign_name" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"note" text,
	"status" "offer_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_follow_up" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" "lost_reason";--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "list_price" bigint;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "target_price" bigint;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "dealer_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "dealer_branch" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "dealer_address" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "dealer_phone" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "employee_id" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "experience_years" integer;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "verification_status" "verification_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "verification_note" text;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "nationwide" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "response_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "sales_profile" ADD COLUMN "avg_response_minutes" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_benefits" ADD CONSTRAINT "offer_benefits_offer_id_sales_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."sales_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_coverage" ADD CONSTRAINT "sales_coverage_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_offers" ADD CONSTRAINT "sales_offers_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dealers_name_branch_key" ON "dealers" USING btree ("name","branch");--> statement-breakpoint
CREATE INDEX "dealers_city_idx" ON "dealers" USING btree ("city");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_created_idx" ON "lead_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "offer_benefits_offer_idx" ON "offer_benefits" USING btree ("offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_benefits_offer_benefit_key" ON "offer_benefits" USING btree ("offer_id","benefit");--> statement-breakpoint
CREATE INDEX "sales_coverage_sales_idx" ON "sales_coverage" USING btree ("sales_id");--> statement-breakpoint
CREATE INDEX "sales_coverage_area_idx" ON "sales_coverage" USING btree ("province","city");--> statement-breakpoint
CREATE INDEX "sales_documents_sales_idx" ON "sales_documents" USING btree ("sales_id");--> statement-breakpoint
CREATE INDEX "sales_offers_match_idx" ON "sales_offers" USING btree ("brand","model","status");--> statement-breakpoint
CREATE INDEX "sales_offers_sales_idx" ON "sales_offers" USING btree ("sales_id","status");--> statement-breakpoint
CREATE INDEX "sales_offers_expiry_idx" ON "sales_offers" USING btree ("status","ends_at");--> statement-breakpoint
ALTER TABLE "sales_profile" ADD CONSTRAINT "sales_profile_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_follow_up_idx" ON "leads" USING btree ("sales_id","next_follow_up");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_profile_slug_key" ON "sales_profile" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sales_profile_verification_idx" ON "sales_profile" USING btree ("verification_status");