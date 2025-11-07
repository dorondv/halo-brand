-- ============================================================================
-- Initial Database Schema
-- ============================================================================
-- This migration creates the core database schema with all tables, foreign keys,
-- and proper CASCADE delete constraints for data integrity.
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"name" text,
	"first_name" text,
	"last_name" text,
	"id_number" text,
	"provider" varchar(50),
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

-- Social accounts table
CREATE TABLE IF NOT EXISTS "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand_id" uuid,
	"platform" varchar(50) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"account_name" text NOT NULL,
	"account_id" text NOT NULL,
	"platform_specific_data" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Posts table
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand_id" uuid,
	"content" text NOT NULL,
	"image_url" text,
	"ai_caption" text,
	"hashtags" text[],
	"media_type" varchar(20) DEFAULT 'text',
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Scheduled posts table
CREATE TABLE IF NOT EXISTS "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"published_at" timestamp,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_details" jsonb,
	"platform_response" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Post analytics table
CREATE TABLE IF NOT EXISTS "post_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"impressions" integer,
	"date" timestamp NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Foreign key constraints with CASCADE deletes for data integrity
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'social_accounts_user_id_users_id_fk'
	) THEN
		ALTER TABLE "social_accounts" 
			ADD CONSTRAINT "social_accounts_user_id_users_id_fk" 
			FOREIGN KEY ("user_id") 
			REFERENCES "public"."users"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'posts_user_id_users_id_fk'
	) THEN
		ALTER TABLE "posts" 
			ADD CONSTRAINT "posts_user_id_users_id_fk" 
			FOREIGN KEY ("user_id") 
			REFERENCES "public"."users"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;
	-- Note: brand_id foreign keys are created in migration 0001 after brands table is created

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'scheduled_posts_post_id_posts_id_fk'
	) THEN
		ALTER TABLE "scheduled_posts" 
			ADD CONSTRAINT "scheduled_posts_post_id_posts_id_fk" 
			FOREIGN KEY ("post_id") 
			REFERENCES "public"."posts"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'scheduled_posts_social_account_id_social_accounts_id_fk'
	) THEN
		ALTER TABLE "scheduled_posts" 
			ADD CONSTRAINT "scheduled_posts_social_account_id_social_accounts_id_fk" 
			FOREIGN KEY ("social_account_id") 
			REFERENCES "public"."social_accounts"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'post_analytics_post_id_posts_id_fk'
	) THEN
		ALTER TABLE "post_analytics" 
			ADD CONSTRAINT "post_analytics_post_id_posts_id_fk" 
			FOREIGN KEY ("post_id") 
			REFERENCES "public"."posts"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE "users" IS 'User accounts table';
COMMENT ON TABLE "social_accounts" IS 'Connected social media accounts';
COMMENT ON TABLE "posts" IS 'User-created posts';
COMMENT ON TABLE "scheduled_posts" IS 'Posts scheduled for publication';
COMMENT ON TABLE "post_analytics" IS 'Analytics data for published posts';

