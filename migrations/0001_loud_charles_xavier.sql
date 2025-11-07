-- ============================================================================
-- Add Brands Table
-- ============================================================================
-- This migration adds the brands table and updates posts and social_accounts
-- to support brand associations with CASCADE deletes.
-- ============================================================================

-- Create brands table
CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add brand_id columns (already included in 0000_init-db.sql, but kept here for idempotency)
-- These ALTER TABLE statements will be no-ops if columns already exist
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "brand_id" uuid;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "brand_id" uuid;

-- Add foreign key constraints with CASCADE deletes
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'brands_user_id_users_id_fk'
	) THEN
		ALTER TABLE "brands" 
			ADD CONSTRAINT "brands_user_id_users_id_fk" 
			FOREIGN KEY ("user_id") 
			REFERENCES "public"."users"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;

	-- Foreign keys for brand_id are now created in 0000_init-db.sql
	-- But we keep these checks here for idempotency in case migration 0000 hasn't run yet
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'posts_brand_id_brands_id_fk'
	) THEN
		ALTER TABLE "posts" 
			ADD CONSTRAINT "posts_brand_id_brands_id_fk" 
			FOREIGN KEY ("brand_id") 
			REFERENCES "public"."brands"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_brand_id_brands_id_fk'
	) THEN
		ALTER TABLE "social_accounts" 
			ADD CONSTRAINT "social_accounts_brand_id_brands_id_fk" 
			FOREIGN KEY ("brand_id") 
			REFERENCES "public"."brands"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;
END $$;

-- Add comments
COMMENT ON TABLE "brands" IS 'User brands/organizations';
COMMENT ON COLUMN "posts"."brand_id" IS 'Optional brand association for posts';
COMMENT ON COLUMN "social_accounts"."brand_id" IS 'Optional brand association for social accounts';

