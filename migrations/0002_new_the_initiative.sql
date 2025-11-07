-- ============================================================================
-- Add User Profile Fields
-- ============================================================================
-- This migration adds user profile fields including personal information,
-- OAuth provider tracking, and avatar URL support.
-- ============================================================================

-- Add user profile and OAuth fields (already included in 0000_init-db.sql, but kept here for idempotency)
-- These ALTER TABLE statements will be no-ops if columns already exist
ALTER TABLE "users" 
	ADD COLUMN IF NOT EXISTS "first_name" text,
	ADD COLUMN IF NOT EXISTS "last_name" text,
	ADD COLUMN IF NOT EXISTS "id_number" text,
	ADD COLUMN IF NOT EXISTS "provider" varchar(50),
	ADD COLUMN IF NOT EXISTS "avatar_url" text;

-- Add comments
COMMENT ON COLUMN "users"."first_name" IS 'User first name';
COMMENT ON COLUMN "users"."last_name" IS 'User last name';
COMMENT ON COLUMN "users"."id_number" IS 'User identification number';
COMMENT ON COLUMN "users"."provider" IS 'OAuth provider (email, google, facebook, twitter, github, linkedin, etc.)';
COMMENT ON COLUMN "users"."avatar_url" IS 'User avatar URL extracted from OAuth provider metadata or auth.users';

