-- ============================================================================
-- Add Getlate.com API Integration Fields
-- ============================================================================
-- This migration adds Getlate-specific fields to support API integration:
-- - Users: getlate_api_key (encrypted API key)
-- - Brands: getlate_profile_id (maps to Getlate profile)
-- - Social Accounts: getlate_account_id (maps to Getlate account)
-- - Posts: getlate_post_id, timezone, platforms, queued_from_brand
-- - Scheduled Posts: timezone
-- - Post Analytics: getlate_post_id, platform, engagement_rate
-- ============================================================================

-- Step 1: Add getlate_api_key to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS getlate_api_key TEXT;

-- Step 2: Add getlate_profile_id to brands table
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS getlate_profile_id TEXT;

-- Step 3: Add getlate_account_id to social_accounts table
ALTER TABLE public.social_accounts
ADD COLUMN IF NOT EXISTS getlate_account_id TEXT;

-- Step 4: Add Getlate fields to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS getlate_post_id TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS platforms JSONB,
ADD COLUMN IF NOT EXISTS queued_from_brand BOOLEAN DEFAULT false;

-- Step 5: Add timezone to scheduled_posts table
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Step 6: Add Getlate fields to post_analytics table
ALTER TABLE public.post_analytics
ADD COLUMN IF NOT EXISTS getlate_post_id TEXT,
ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
ADD COLUMN IF NOT EXISTS engagement_rate TEXT;

-- Step 7: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_brands_getlate_profile_id ON public.brands(getlate_profile_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_getlate_account_id ON public.social_accounts(getlate_account_id);
CREATE INDEX IF NOT EXISTS idx_posts_getlate_post_id ON public.posts(getlate_post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_getlate_post_id ON public.post_analytics(getlate_post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_platform ON public.post_analytics(platform);

-- Add comments for documentation
COMMENT ON COLUMN public.users.getlate_api_key IS 'Encrypted Getlate API key for user';
COMMENT ON COLUMN public.brands.getlate_profile_id IS 'Getlate profile ID (maps to our brand)';
COMMENT ON COLUMN public.social_accounts.getlate_account_id IS 'Getlate account ID';
COMMENT ON COLUMN public.posts.getlate_post_id IS 'Getlate post ID for tracking';
COMMENT ON COLUMN public.posts.timezone IS 'IANA timezone (e.g., "America/New_York")';
COMMENT ON COLUMN public.posts.platforms IS 'Array of platform configs from Getlate';
COMMENT ON COLUMN public.posts.queued_from_brand IS 'If post was added via queue system';
COMMENT ON COLUMN public.scheduled_posts.timezone IS 'IANA timezone for scheduled post';
COMMENT ON COLUMN public.post_analytics.getlate_post_id IS 'Reference to Getlate post';
COMMENT ON COLUMN public.post_analytics.platform IS 'Platform name';
COMMENT ON COLUMN public.post_analytics.engagement_rate IS 'Engagement rate as decimal string';


