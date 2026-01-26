-- ============================================================================
-- Prevent Duplicate Analytics Records
-- ============================================================================
-- This migration adds a unique constraint to prevent duplicate analytics records
-- for the same post, platform, date, and Getlate post ID combination.
-- ============================================================================

-- Step 1: Clean up existing duplicates before creating unique indexes
-- For records with NULL getlate_post_id: keep the most recent one per (post_id, platform, date)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete duplicates where getlate_post_id IS NULL
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
  RAISE NOTICE 'Deleted % duplicate records with NULL getlate_post_id', deleted_count;
END $$;

-- Step 2: Clean up duplicates where getlate_post_id IS NOT NULL
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
  RAISE NOTICE 'Deleted % duplicate records with non-NULL getlate_post_id', deleted_count;
END $$;

-- Step 3: Create unique indexes to prevent future duplicates
-- Note: getlate_post_id can be NULL, so we use partial unique indexes to handle NULL values properly
DO $$
BEGIN
  -- Check if indexes already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'post_analytics_unique_post_platform_date_null_getlate_idx'
  ) THEN
    -- Create partial unique index for NULL getlate_post_id cases
    -- This ensures one record per post+platform+date when getlate_post_id is NULL
    CREATE UNIQUE INDEX post_analytics_unique_post_platform_date_null_getlate_idx
    ON public.post_analytics (post_id, platform, date)
    WHERE getlate_post_id IS NULL;
    
    RAISE NOTICE 'Unique index for NULL getlate_post_id added to post_analytics';
  ELSE
    RAISE NOTICE 'Unique index for NULL getlate_post_id already exists';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'post_analytics_unique_post_platform_date_getlate_not_null_idx'
  ) THEN
    -- Create unique index for non-NULL getlate_post_id cases
    -- This ensures one record per post+platform+date+getlate_post_id when getlate_post_id is NOT NULL
    CREATE UNIQUE INDEX post_analytics_unique_post_platform_date_getlate_not_null_idx
    ON public.post_analytics (post_id, platform, date, getlate_post_id)
    WHERE getlate_post_id IS NOT NULL;
    
    RAISE NOTICE 'Unique index for non-NULL getlate_post_id added to post_analytics';
  ELSE
    RAISE NOTICE 'Unique index for non-NULL getlate_post_id already exists';
  END IF;
END $$;

-- Add comments
COMMENT ON INDEX post_analytics_unique_post_platform_date_null_getlate_idx IS 'Prevents duplicate analytics records when getlate_post_id is NULL';
COMMENT ON INDEX post_analytics_unique_post_platform_date_getlate_not_null_idx IS 'Prevents duplicate analytics records when getlate_post_id is NOT NULL';
