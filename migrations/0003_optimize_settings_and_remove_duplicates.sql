-- ============================================================================
-- Add Settings Table and Optimize User Creation
-- ============================================================================
-- This migration:
-- 1. Creates settings table for user preferences
-- 2. Creates default settings for existing users
-- 3. Creates optimized trigger function with provider-aware avatar extraction
-- Note: Preference columns (language, timezone, country, light_mode) were never
-- created in the users table, so no migration or removal is needed.
-- ============================================================================

-- Step 1: Create settings table for user preferences
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  language TEXT DEFAULT 'he' NOT NULL,
  timezone TEXT DEFAULT 'Asia/Jerusalem' NOT NULL,
  country TEXT DEFAULT 'il' NOT NULL,
  dark_mode BOOLEAN DEFAULT false NOT NULL, -- false = light mode, true = dark mode
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Step 2: Create index on settings.user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON public.settings(user_id);

-- Step 3: Create default settings for existing users (if any exist)
-- This ensures all existing users have settings records
DO $$
BEGIN
  INSERT INTO public.settings (
    user_id,
    language,
    timezone,
    country,
    dark_mode,
    updated_at,
    created_at
  )
  SELECT 
    u.id,
    'he' as language,
    'Asia/Jerusalem' as timezone,
    'il' as country,
    false as dark_mode, -- light mode by default
    u.updated_at,
    u.created_at
  FROM public.users u
  LEFT JOIN public.settings s ON u.id = s.user_id
  WHERE s.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Step 4: Drop and recreate trigger function with optimized avatar extraction
-- Note: Creating triggers on auth.users requires service role permissions in Supabase
-- If this fails, you may need to run this part manually via Supabase Dashboard with service role
DO $$
BEGIN
  -- Drop trigger if it exists (may fail if no permissions, that's okay)
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop trigger (may require service role): %', SQLERRM;
  END;
  
  -- Drop function if it exists
  DROP FUNCTION IF EXISTS public.handle_new_user();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop function: %', SQLERRM;
END $$;

-- Optimized function with provider-aware avatar URL extraction and error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_provider TEXT;
  user_full_name TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  user_avatar_url TEXT;
  identity_data JSONB;
BEGIN
  -- Extract provider and identity data with proper prioritization
  -- Priority: OAuth providers > email provider
  -- Also check raw_user_meta_data as fallback if identities aren't available yet
  BEGIN
    -- First, try to get OAuth provider (prefer non-email providers)
    SELECT 
      i.provider,
      i.identity_data
    INTO 
      user_provider,
      identity_data
    FROM auth.identities i
    WHERE i.user_id = NEW.id
      AND i.provider != 'email'  -- Prefer OAuth providers
    ORDER BY 
      CASE 
        WHEN i.provider IN ('google', 'facebook', 'github', 'twitter', 'linkedin', 'apple') THEN 0
        ELSE 1
      END,
      i.created_at DESC
    LIMIT 1;
    
    -- If no OAuth provider found, get email provider as fallback
    IF user_provider IS NULL THEN
      SELECT 
        i.provider,
        i.identity_data
      INTO 
        user_provider,
        identity_data
      FROM auth.identities i
      WHERE i.user_id = NEW.id
        AND i.provider = 'email'
      ORDER BY i.created_at DESC
      LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If query fails (e.g., auth.identities doesn't exist yet), try to infer from metadata
    user_provider := NULL;
    identity_data := NULL;
    
    -- Try to infer provider from raw_user_meta_data
    IF NEW.raw_user_meta_data IS NOT NULL THEN
      -- Check for provider-specific indicators in metadata
      IF NEW.raw_user_meta_data->>'iss' IS NOT NULL THEN
        user_provider := CASE
          WHEN NEW.raw_user_meta_data->>'iss' LIKE '%google%' OR NEW.raw_user_meta_data->>'iss' LIKE '%accounts.google.com%' THEN 'google'
          WHEN NEW.raw_user_meta_data->>'iss' LIKE '%facebook%' OR NEW.raw_user_meta_data->>'iss' LIKE '%fb.com%' THEN 'facebook'
          WHEN NEW.raw_user_meta_data->>'iss' LIKE '%github%' THEN 'github'
          WHEN NEW.raw_user_meta_data->>'iss' LIKE '%twitter%' OR NEW.raw_user_meta_data->>'iss' LIKE '%x.com%' THEN 'twitter'
          WHEN NEW.raw_user_meta_data->>'iss' LIKE '%linkedin%' THEN 'linkedin'
          WHEN NEW.raw_user_meta_data->>'iss' LIKE '%apple%' THEN 'apple'
          ELSE NULL
        END;
      END IF;
      
      -- Check explicit provider field in metadata
      IF user_provider IS NULL AND NEW.raw_user_meta_data->>'provider' IS NOT NULL THEN
        user_provider := NEW.raw_user_meta_data->>'provider';
      END IF;
      
      -- Check for provider-specific avatar URLs as hints
      IF user_provider IS NULL THEN
        IF NEW.raw_user_meta_data->>'profile_image_url' IS NOT NULL 
           OR NEW.raw_user_meta_data->>'profile_image_url_https' IS NOT NULL THEN
          user_provider := 'twitter';
        ELSIF NEW.raw_user_meta_data->>'profilePicture' IS NOT NULL THEN
          user_provider := 'linkedin';
        ELSIF NEW.raw_user_meta_data->>'picture' IS NOT NULL 
           AND (NEW.raw_user_meta_data->>'picture' LIKE '%googleusercontent.com%' 
                OR NEW.raw_user_meta_data->>'picture' LIKE '%fbcdn.net%'
                OR NEW.raw_user_meta_data->>'picture' LIKE '%githubusercontent.com%') THEN
          -- Infer from picture URL domain
          user_provider := CASE
            WHEN NEW.raw_user_meta_data->>'picture' LIKE '%googleusercontent.com%' THEN 'google'
            WHEN NEW.raw_user_meta_data->>'picture' LIKE '%fbcdn.net%' THEN 'facebook'
            WHEN NEW.raw_user_meta_data->>'picture' LIKE '%githubusercontent.com%' THEN 'github'
            ELSE NULL
          END;
        END IF;
      END IF;
    END IF;
  END;
  
  -- Default to 'email' if provider is still NULL
  user_provider := COALESCE(user_provider, 'email');
  
  -- Extract full name from metadata (handle NULL email)
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    CASE 
      WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1)
      ELSE 'User'
    END,
    'User'
  );
  
  -- Extract first and last name
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'given_name',
    CASE 
      WHEN position(' ' in user_full_name) > 0 
      THEN split_part(user_full_name, ' ', 1)
      ELSE NULL
    END
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'family_name',
    CASE 
      WHEN position(' ' in user_full_name) > 0 
      THEN substring(user_full_name from position(' ' in user_full_name) + 1)
      ELSE NULL
    END
  );
  
  -- Extract avatar URL with provider-specific logic
  -- Priority: identity_data (most reliable) > raw_user_meta_data > provider-specific fields
  -- NOTE: auth.users table does NOT have an avatar_url column
  user_avatar_url := COALESCE(
    -- First, try identity_data (most reliable for OAuth providers)
    CASE 
      WHEN identity_data IS NOT NULL THEN
        COALESCE(
          identity_data->>'avatar_url',
          identity_data->>'picture',
          identity_data->>'photoURL',
          identity_data->>'photo_url',
          identity_data->>'profile_image_url',
          identity_data->>'profile_image_url_https',
          identity_data->>'image',
          identity_data->>'profilePicture',
          NULL
        )
      ELSE NULL
    END,
    -- Then try provider-specific fields in raw_user_meta_data
    CASE 
      WHEN user_provider = 'google' THEN 
        COALESCE(
          NEW.raw_user_meta_data->>'picture',
          NEW.raw_user_meta_data->>'avatar_url',
          NEW.raw_user_meta_data->>'photoURL',
          NULL
        )
      WHEN user_provider = 'facebook' THEN 
        COALESCE(
          NEW.raw_user_meta_data->>'picture',
          NEW.raw_user_meta_data->>'avatar_url',
          NULL
        )
      WHEN user_provider = 'github' THEN 
        COALESCE(
          NEW.raw_user_meta_data->>'avatar_url',
          NEW.raw_user_meta_data->>'picture',
          NULL
        )
      WHEN user_provider = 'twitter' THEN 
        COALESCE(
          NEW.raw_user_meta_data->>'profile_image_url_https',
          NEW.raw_user_meta_data->>'profile_image_url',
          NEW.raw_user_meta_data->>'avatar_url',
          NULL
        )
      WHEN user_provider = 'linkedin' THEN 
        COALESCE(
          NEW.raw_user_meta_data->>'picture',
          NEW.raw_user_meta_data->>'profilePicture',
          NEW.raw_user_meta_data->>'avatar_url',
          NULL
        )
      WHEN user_provider = 'apple' THEN 
        COALESCE(
          NEW.raw_user_meta_data->>'picture',
          NEW.raw_user_meta_data->>'avatar_url',
          NULL
        )
      ELSE NULL
    END,
    -- Fallback to common OAuth provider fields (for any provider)
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'photoURL',
    NEW.raw_user_meta_data->>'photo_url',
    NEW.raw_user_meta_data->>'image',
    NEW.raw_user_meta_data->>'profile_image_url',
    NEW.raw_user_meta_data->>'profile_image_url_https',
    NULL
  );
  
  -- Validate UUID
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'Invalid user ID: cannot be NULL';
  END IF;

  -- Insert into users table (handle NULL/empty email)
  -- Column order: id, email, plan, name, is_active, first_name, last_name, id_number, provider, avatar_url, updated_at, created_at
  INSERT INTO public.users (
    id,
    email,
    plan,
    name,
    is_active,
    first_name,
    last_name,
    id_number,
    provider,
    avatar_url,
    updated_at,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.email), ''), 'user@example.com'),
    'free',
    COALESCE(user_full_name, 'User'),
    true,
    user_first_name,
    user_last_name,
    NULL, -- id_number is not available from OAuth
    COALESCE(user_provider, 'email'),
    user_avatar_url,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), public.users.email),
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = NOW();
  
  -- Create default settings record
  INSERT INTO public.settings (
    user_id,
    language,
    timezone,
    country,
    dark_mode,
    updated_at,
    created_at
  )
  VALUES (
    NEW.id,
    'he',
    'Asia/Jerusalem',
    'il',
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION 
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user trigger for user %: % (SQLSTATE: %)', 
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
-- Note: Creating triggers on auth.users requires service role permissions in Supabase
-- If this fails, create the trigger manually via Supabase Dashboard SQL Editor with service role
DO $$
BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not create trigger on auth.users. This requires service role permissions.';
  RAISE NOTICE 'Please run this manually in Supabase Dashboard SQL Editor with service role:';
  RAISE NOTICE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
WHEN duplicate_object THEN
  RAISE NOTICE 'Trigger already exists, skipping.';
WHEN OTHERS THEN
  RAISE NOTICE 'Error creating trigger: %', SQLERRM;
END $$;

-- Step 5: (No deprecated columns to remove - preference columns were never created in users table)
-- All user preferences are stored in the settings table from the start.

-- Add comments for documentation
DO $$
BEGIN
  COMMENT ON TABLE public.settings IS 'User preferences and settings (language, timezone, dark mode, etc.)';
  COMMENT ON COLUMN public.settings.dark_mode IS 'false = light mode, true = dark mode';
  COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user and settings records when a new user signs up. Extracts avatar_url from provider-specific metadata (Google, Facebook, GitHub, Twitter, LinkedIn, etc.).';
EXCEPTION WHEN OTHERS THEN
  -- Comments are optional, ignore errors
  NULL;
END $$;

