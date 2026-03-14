-- ============================================================================
-- Remove id_number column from users table
-- ============================================================================
-- This migration removes the id_number (תעודת זהות/דרכון) field from users.
-- The field is no longer needed in the application.
-- Order: First update handle_new_user (so new signups work), then drop column.
-- ============================================================================

-- Recreate handle_new_user to remove id_number from INSERT (trigger from 0003)
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
  BEGIN
    SELECT i.provider, i.identity_data
    INTO user_provider, identity_data
    FROM auth.identities i
    WHERE i.user_id = NEW.id AND i.provider != 'email'
    ORDER BY CASE WHEN i.provider IN ('google', 'facebook', 'github', 'twitter', 'linkedin', 'apple') THEN 0 ELSE 1 END, i.created_at DESC
    LIMIT 1;
    IF user_provider IS NULL THEN
      SELECT i.provider, i.identity_data
      INTO user_provider, identity_data
      FROM auth.identities i
      WHERE i.user_id = NEW.id AND i.provider = 'email'
      ORDER BY i.created_at DESC
      LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    user_provider := NULL;
    identity_data := NULL;
    IF NEW.raw_user_meta_data IS NOT NULL THEN
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
      IF user_provider IS NULL AND NEW.raw_user_meta_data->>'provider' IS NOT NULL THEN
        user_provider := NEW.raw_user_meta_data->>'provider';
      END IF;
      IF user_provider IS NULL THEN
        IF NEW.raw_user_meta_data->>'profile_image_url' IS NOT NULL OR NEW.raw_user_meta_data->>'profile_image_url_https' IS NOT NULL THEN
          user_provider := 'twitter';
        ELSIF NEW.raw_user_meta_data->>'profilePicture' IS NOT NULL THEN
          user_provider := 'linkedin';
        ELSIF NEW.raw_user_meta_data->>'picture' IS NOT NULL AND (NEW.raw_user_meta_data->>'picture' LIKE '%googleusercontent.com%' OR NEW.raw_user_meta_data->>'picture' LIKE '%fbcdn.net%' OR NEW.raw_user_meta_data->>'picture' LIKE '%githubusercontent.com%') THEN
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
  user_provider := COALESCE(user_provider, 'email');
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE 'User' END, 'User');
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'given_name', CASE WHEN position(' ' in user_full_name) > 0 THEN split_part(user_full_name, ' ', 1) ELSE NULL END);
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'family_name', CASE WHEN position(' ' in user_full_name) > 0 THEN substring(user_full_name from position(' ' in user_full_name) + 1) ELSE NULL END);
  user_avatar_url := COALESCE(
    CASE WHEN identity_data IS NOT NULL THEN COALESCE(identity_data->>'avatar_url', identity_data->>'picture', identity_data->>'photoURL', identity_data->>'photo_url', identity_data->>'profile_image_url', identity_data->>'profile_image_url_https', identity_data->>'image', identity_data->>'profilePicture', NULL) ELSE NULL END,
    CASE
      WHEN user_provider = 'google' THEN COALESCE(NEW.raw_user_meta_data->>'picture', NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'photoURL', NULL)
      WHEN user_provider = 'facebook' THEN COALESCE(NEW.raw_user_meta_data->>'picture', NEW.raw_user_meta_data->>'avatar_url', NULL)
      WHEN user_provider = 'github' THEN COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
      WHEN user_provider = 'twitter' THEN COALESCE(NEW.raw_user_meta_data->>'profile_image_url_https', NEW.raw_user_meta_data->>'profile_image_url', NEW.raw_user_meta_data->>'avatar_url', NULL)
      WHEN user_provider = 'linkedin' THEN COALESCE(NEW.raw_user_meta_data->>'picture', NEW.raw_user_meta_data->>'profilePicture', NEW.raw_user_meta_data->>'avatar_url', NULL)
      WHEN user_provider = 'apple' THEN COALESCE(NEW.raw_user_meta_data->>'picture', NEW.raw_user_meta_data->>'avatar_url', NULL)
      ELSE NULL
    END,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'photoURL',
    NEW.raw_user_meta_data->>'photo_url',
    NEW.raw_user_meta_data->>'image',
    NEW.raw_user_meta_data->>'profile_image_url',
    NEW.raw_user_meta_data->>'profile_image_url_https',
    NULL
  );
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'Invalid user ID: cannot be NULL';
  END IF;
  INSERT INTO public.users (id, email, plan, name, is_active, first_name, last_name, provider, avatar_url, updated_at, created_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.email), ''), 'user@example.com'),
    'free',
    COALESCE(user_full_name, 'User'),
    true,
    user_first_name,
    user_last_name,
    COALESCE(user_provider, 'email'),
    user_avatar_url,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), public.users.email),
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = NOW();
  INSERT INTO public.settings (user_id, language, timezone, country, dark_mode, updated_at, created_at)
  VALUES (NEW.id, 'he', 'Asia/Jerusalem', 'il', false, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user trigger for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE "users" DROP COLUMN IF EXISTS "id_number";
