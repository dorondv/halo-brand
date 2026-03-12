-- ============================================================================
-- Add User Usage Tracking Table
-- ============================================================================
-- This migration creates a table to track user usage counters for:
-- - AI content generations (per month)
-- - AI image generations (per month)
-- - Posts created (per month)
-- This allows efficient tracking and enforcement of plan-based limits
-- ============================================================================

-- User Usage Tracking table
CREATE TABLE IF NOT EXISTS "user_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" integer NOT NULL, -- 1-12 (January = 1, December = 12)
	"year" integer NOT NULL, -- e.g., 2025
	"ai_content_generations" integer DEFAULT 0 NOT NULL, -- Count of AI-generated content (captions, suggestions)
	"ai_image_generations" integer DEFAULT 0 NOT NULL, -- Count of AI-generated images (DALL-E, etc.)
	"posts_created" integer DEFAULT 0 NOT NULL, -- Count of posts created this month
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	-- Ensure one record per user per month
	CONSTRAINT "user_usage_user_month_year_unique" UNIQUE("user_id", "month", "year")
);

-- Foreign key constraint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'user_usage_user_id_users_id_fk'
	) THEN
		ALTER TABLE "user_usage" 
			ADD CONSTRAINT "user_usage_user_id_users_id_fk" 
			FOREIGN KEY ("user_id") 
			REFERENCES "public"."users"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "user_usage_user_id_idx" ON "user_usage"("user_id");
CREATE INDEX IF NOT EXISTS "user_usage_month_year_idx" ON "user_usage"("month", "year");
CREATE INDEX IF NOT EXISTS "user_usage_user_month_year_idx" ON "user_usage"("user_id", "month", "year");

-- Enable Row Level Security (RLS) on user_usage table
ALTER TABLE "user_usage" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only view and update their own usage records
DO $$
BEGIN
  -- Policy for SELECT: Users can only see their own usage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_usage' 
    AND policyname = 'Users can view own usage'
  ) THEN
    CREATE POLICY "Users can view own usage" ON "user_usage"
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Policy for INSERT: Users can create their own usage records
  -- Note: The function will handle this, but we allow direct inserts too
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_usage' 
    AND policyname = 'Users can insert own usage'
  ) THEN
    CREATE POLICY "Users can insert own usage" ON "user_usage"
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policy for UPDATE: Users can update their own usage records
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_usage' 
    AND policyname = 'Users can update own usage'
  ) THEN
    CREATE POLICY "Users can update own usage" ON "user_usage"
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE "user_usage" IS 'Tracks monthly usage counters for AI content generations, image generations, and posts per user';
COMMENT ON COLUMN "user_usage"."month" IS 'Month number (1-12, where 1 = January, 12 = December)';
COMMENT ON COLUMN "user_usage"."year" IS 'Year (e.g., 2025)';
COMMENT ON COLUMN "user_usage"."ai_content_generations" IS 'Count of AI-generated content (captions, suggestions, etc.) this month';
COMMENT ON COLUMN "user_usage"."ai_image_generations" IS 'Count of AI-generated images (DALL-E, etc.) this month';
COMMENT ON COLUMN "user_usage"."posts_created" IS 'Count of posts created this month';

-- Create a function to get or create usage record for current month
-- This function ensures we always have a record for the current month
CREATE OR REPLACE FUNCTION get_or_create_user_usage(
	p_user_id uuid,
	p_month integer DEFAULT NULL,
	p_year integer DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
	v_month integer;
	v_year integer;
	v_usage_id uuid;
BEGIN
	-- Use current month/year if not provided
	v_month := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::integer);
	v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
	
	-- Try to get existing record
	SELECT id INTO v_usage_id
	FROM user_usage
	WHERE user_id = p_user_id
		AND month = v_month
		AND year = v_year;
	
	-- Create if doesn't exist
	IF v_usage_id IS NULL THEN
		INSERT INTO user_usage (user_id, month, year, ai_content_generations, ai_image_generations, posts_created)
		VALUES (p_user_id, v_month, v_year, 0, 0, 0)
		RETURNING id INTO v_usage_id;
	END IF;
	
	RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to increment usage counters atomically
-- This prevents race conditions when multiple requests update counters simultaneously
CREATE OR REPLACE FUNCTION increment_user_usage(
	p_user_id uuid,
	p_counter_type text, -- 'ai_content', 'ai_image', or 'post'
	p_amount integer DEFAULT 1
) RETURNS boolean AS $$
DECLARE
	v_month integer;
	v_year integer;
	v_usage_id uuid;
BEGIN
	-- Get current month/year
	v_month := EXTRACT(MONTH FROM CURRENT_DATE)::integer;
	v_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
	
	-- Get or create usage record
	v_usage_id := get_or_create_user_usage(p_user_id, v_month, v_year);
	
	-- Increment the appropriate counter
	IF p_counter_type = 'ai_content' THEN
		UPDATE user_usage
		SET ai_content_generations = ai_content_generations + p_amount,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = v_usage_id;
	ELSIF p_counter_type = 'ai_image' THEN
		UPDATE user_usage
		SET ai_image_generations = ai_image_generations + p_amount,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = v_usage_id;
	ELSIF p_counter_type = 'post' THEN
		UPDATE user_usage
		SET posts_created = posts_created + p_amount,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = v_usage_id;
	ELSE
		RAISE EXCEPTION 'Invalid counter type: %', p_counter_type;
	END IF;
	
	RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions to authenticated users
-- SECURITY DEFINER allows functions to bypass RLS when needed
-- This allows API routes to call these functions
GRANT EXECUTE ON FUNCTION get_or_create_user_usage(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_user_usage(uuid, text, integer) TO authenticated;

-- Add comment for functions
COMMENT ON FUNCTION get_or_create_user_usage(uuid, integer, integer) IS 'Gets or creates a usage record for a user for the specified month/year';
COMMENT ON FUNCTION increment_user_usage(uuid, text, integer) IS 'Atomically increments a usage counter for the current month';
