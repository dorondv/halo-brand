-- ============================================================================
-- Security Advisor Fixes
-- ============================================================================
-- Addresses Supabase splinter findings:
-- 1. Function search_path mutable (get_or_create_user_usage, increment_user_usage, handle_new_user)
-- 2. marketing_events RLS policy overly permissive (INSERT WITH CHECK true)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Set immutable search_path on functions (prevents search_path injection)
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.get_or_create_user_usage(uuid, integer, integer)
  SET search_path = public;

ALTER FUNCTION public.increment_user_usage(uuid, text, integer)
  SET search_path = public;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public;

-- ----------------------------------------------------------------------------
-- 2. Restrict marketing_events INSERT policy
-- Allow: user_id IS NULL (anon pre-signup) OR user_id = auth.uid() (authenticated)
-- Prevents: inserting events with another user's user_id
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert marketing events" ON "marketing_events";
DROP POLICY IF EXISTS "Users can insert own or anonymous marketing events" ON "marketing_events";
CREATE POLICY "Users can insert own or anonymous marketing events" ON "marketing_events"
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());
