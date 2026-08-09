-- Carry the old boolean over before it disappears. Migration 0001 added
-- `verification_status` with DEFAULT 'pending', so without this every already-verified
-- sales user would silently drop back to "sedang ditinjau" and lose their badge.
UPDATE "sales_profile" SET "verification_status" = 'verified', "verified_at" = COALESCE("verified_at", now()) WHERE "verified_badge" = true;--> statement-breakpoint
ALTER TABLE "sales_profile" DROP COLUMN "verified_badge";