ALTER TABLE "redemptions" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "payload_url" text;