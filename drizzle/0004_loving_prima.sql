CREATE TYPE "public"."auction_entry_status" AS ENUM('valid', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."auction_status" AS ENUM('open', 'awarded', 'no_bids', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('auction', 'pool');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'auction_outbid';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'auction_won';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'auction_lost';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'auction_closing';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE 'auction';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE 'pool';--> statement-breakpoint
CREATE TABLE "auction_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"sales_id" uuid NOT NULL,
	"offer_id" uuid,
	"offered_price" bigint NOT NULL,
	"discount_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"sales_id" uuid NOT NULL,
	"best_price" bigint NOT NULL,
	"best_price_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bid_count" integer DEFAULT 1 NOT NULL,
	"status" "auction_entry_status" DEFAULT 'valid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"target_price" bigint NOT NULL,
	"list_price" bigint,
	"tier" "car_tier" NOT NULL,
	"status" "auction_status" DEFAULT 'open' NOT NULL,
	"opens_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"extension_count" integer DEFAULT 0 NOT NULL,
	"winner_sales_id" uuid,
	"winning_price" bigint,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source" "lead_source" DEFAULT 'pool' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "committed_price" bigint;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_offer_id_sales_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."sales_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_entries" ADD CONSTRAINT "auction_entries_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_entries" ADD CONSTRAINT "auction_entries_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_winner_sales_id_users_id_fk" FOREIGN KEY ("winner_sales_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_bids_auction_created_idx" ON "auction_bids" USING btree ("auction_id","created_at");--> statement-breakpoint
CREATE INDEX "auction_bids_sales_created_idx" ON "auction_bids" USING btree ("sales_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_entries_auction_sales_key" ON "auction_entries" USING btree ("auction_id","sales_id");--> statement-breakpoint
CREATE INDEX "auction_entries_rank_idx" ON "auction_entries" USING btree ("auction_id","status","best_price","best_price_at");--> statement-breakpoint
CREATE INDEX "auction_entries_sales_idx" ON "auction_entries" USING btree ("sales_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auctions_request_key" ON "auctions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "auctions_status_closes_idx" ON "auctions" USING btree ("status","closes_at");--> statement-breakpoint
CREATE INDEX "auctions_winner_idx" ON "auctions" USING btree ("winner_sales_id");