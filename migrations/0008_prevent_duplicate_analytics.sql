-- ============================================================================
-- Prevent Duplicate Analytics Records
-- ============================================================================
-- This migration adds a unique constraint to prevent duplicate analytics records
-- for the same post, platform, date, and provider post id combination.
-- ============================================================================

-- Step 1: Clean up existing duplicates before creating unique indexes
-- For rows with NULL provider post id: keep the most recent one per (post_id, platform, date)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete duplicates where provider post id column IS NULL
  -- Keep the record with the latest updated_at or created_at
  WITH duplicates AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY post_id, platform, date 
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) as rn
    FROM public.post_analytics
    WHERE getlate_post_id IS NULL
  )
  DELETE FROM public.post_analytics
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % duplicate records with NULL provider post id', deleted_count;
END $$;

-- Step 2: Clean up duplicates where provider post id column IS NOT NULL
-- Keep the record with the latest updated_at or created_at
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH duplicates AS (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY post_id, platform, date, getlate_post_id 
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) as rn
    FROM public.post_analytics
    WHERE getlate_post_id IS NOT NULL
  )
  DELETE FROM public.post_analytics
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % duplicate records with non-NULL provider post id', deleted_count;
END $$;

-- Step 3: Create unique indexes to prevent future duplicates
-- Note: provider post id can be NULL, so we use partial unique indexes to handle NULL values properly
DO $$
BEGIN
  -- Check if indexes already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'post_analytics_unique_post_platform_date_null_getlate_idx'
  ) THEN
    -- Partial unique index when provider post id is NULL
    -- Ensures one record per post+platform+date in that case
    CREATE UNIQUE INDEX post_analytics_unique_post_platform_date_null_getlate_idx
    ON public.post_analytics (post_id, platform, date)
    WHERE getlate_post_id IS NULL;
    
    RAISE NOTICE 'Unique index for NULL provider post id added to post_analytics';
  ELSE
    RAISE NOTICE 'Unique index for NULL provider post id already exists';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'post_analytics_unique_post_platform_date_getlate_not_null_idx'
  ) THEN
    -- Unique index when provider post id is NOT NULL
    -- Ensures one row per post+platform+date+provider post id
    CREATE UNIQUE INDEX post_analytics_unique_post_platform_date_getlate_not_null_idx
    ON public.post_analytics (post_id, platform, date, getlate_post_id)
    WHERE getlate_post_id IS NOT NULL;
    
    RAISE NOTICE 'Unique index for non-NULL provider post id added to post_analytics';
  ELSE
    RAISE NOTICE 'Unique index for non-NULL provider post id already exists';
  END IF;
END $$;

-- Add comments
COMMENT ON INDEX post_analytics_unique_post_platform_date_null_getlate_idx IS 'Prevents duplicate analytics records when provider post id column is NULL';
COMMENT ON INDEX post_analytics_unique_post_platform_date_getlate_not_null_idx IS 'Prevents duplicate analytics records when provider post id column is NOT NULL';
