-- ============================================================================
-- Enable Row Level Security (RLS) on All Tables
-- ============================================================================
-- This migration enables RLS and creates policies for Supabase.
-- Requires: Supabase (auth.uid() from auth schema)
-- Service role bypasses RLS; anon/authenticated are subject to policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users table
-- Users can read and update their own row (id = auth.uid())
-- ----------------------------------------------------------------------------
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON "users";
CREATE POLICY "Users can view own profile" ON "users"
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON "users";
CREATE POLICY "Users can update own profile" ON "users"
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Settings table
-- Users can CRUD their own settings
-- ----------------------------------------------------------------------------
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON "settings";
CREATE POLICY "Users can view own settings" ON "settings"
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON "settings";
CREATE POLICY "Users can insert own settings" ON "settings"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON "settings";
CREATE POLICY "Users can update own settings" ON "settings"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own settings" ON "settings";
CREATE POLICY "Users can delete own settings" ON "settings"
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Brands table
-- Users can CRUD their own brands
-- ----------------------------------------------------------------------------
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own brands" ON "brands";
CREATE POLICY "Users can view own brands" ON "brands"
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own brands" ON "brands";
CREATE POLICY "Users can insert own brands" ON "brands"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own brands" ON "brands";
CREATE POLICY "Users can update own brands" ON "brands"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own brands" ON "brands";
CREATE POLICY "Users can delete own brands" ON "brands"
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Social accounts table
-- Users can CRUD their own social accounts
-- ----------------------------------------------------------------------------
ALTER TABLE "social_accounts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own social accounts" ON "social_accounts";
CREATE POLICY "Users can view own social accounts" ON "social_accounts"
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own social accounts" ON "social_accounts";
CREATE POLICY "Users can insert own social accounts" ON "social_accounts"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own social accounts" ON "social_accounts";
CREATE POLICY "Users can update own social accounts" ON "social_accounts"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own social accounts" ON "social_accounts";
CREATE POLICY "Users can delete own social accounts" ON "social_accounts"
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Posts table
-- Users can CRUD their own posts
-- ----------------------------------------------------------------------------
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own posts" ON "posts";
CREATE POLICY "Users can view own posts" ON "posts"
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own posts" ON "posts";
CREATE POLICY "Users can insert own posts" ON "posts"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own posts" ON "posts";
CREATE POLICY "Users can update own posts" ON "posts"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON "posts";
CREATE POLICY "Users can delete own posts" ON "posts"
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Scheduled posts table
-- Users can CRUD scheduled posts for their own posts
-- ----------------------------------------------------------------------------
ALTER TABLE "scheduled_posts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scheduled posts" ON "scheduled_posts";
CREATE POLICY "Users can view own scheduled posts" ON "scheduled_posts"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own scheduled posts" ON "scheduled_posts";
CREATE POLICY "Users can insert own scheduled posts" ON "scheduled_posts"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own scheduled posts" ON "scheduled_posts";
CREATE POLICY "Users can update own scheduled posts" ON "scheduled_posts"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own scheduled posts" ON "scheduled_posts";
CREATE POLICY "Users can delete own scheduled posts" ON "scheduled_posts"
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Post analytics table
-- Users can view analytics for their own posts
-- ----------------------------------------------------------------------------
ALTER TABLE "post_analytics" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own post analytics" ON "post_analytics";
CREATE POLICY "Users can view own post analytics" ON "post_analytics"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own post analytics" ON "post_analytics";
CREATE POLICY "Users can insert own post analytics" ON "post_analytics"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own post analytics" ON "post_analytics";
CREATE POLICY "Users can update own post analytics" ON "post_analytics"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own post analytics" ON "post_analytics";
CREATE POLICY "Users can delete own post analytics" ON "post_analytics"
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Subscriptions table
-- Users can CRUD their own subscription
-- ----------------------------------------------------------------------------
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON "subscriptions";
CREATE POLICY "Users can view own subscription" ON "subscriptions"
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subscription" ON "subscriptions";
CREATE POLICY "Users can insert own subscription" ON "subscriptions"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON "subscriptions";
CREATE POLICY "Users can update own subscription" ON "subscriptions"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own subscription" ON "subscriptions";
CREATE POLICY "Users can delete own subscription" ON "subscriptions"
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Billing history table
-- Users can view their own billing history (via subscription)
-- No INSERT/UPDATE/DELETE - handled by server/webhooks with service role
-- ----------------------------------------------------------------------------
ALTER TABLE "billing_history" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing history" ON "billing_history";
CREATE POLICY "Users can view own billing history" ON "billing_history"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Payment webhooks table
-- Server-only: explicit deny-all policy for anon/authenticated
-- Service role bypasses RLS for webhook processing
-- ----------------------------------------------------------------------------
ALTER TABLE "payment_webhooks" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access - service role only" ON "payment_webhooks";
CREATE POLICY "No direct client access - service role only" ON "payment_webhooks"
  FOR ALL USING (false) WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- Coupons table
-- Read-only for authenticated users (to validate codes during checkout)
-- ----------------------------------------------------------------------------
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view coupons" ON "coupons";
CREATE POLICY "Authenticated users can view coupons" ON "coupons"
  FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- Subscription plans table
-- Read-only for all (pricing page visible before sign-in)
-- ----------------------------------------------------------------------------
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view subscription plans" ON "subscription_plans";
CREATE POLICY "Anyone can view subscription plans" ON "subscription_plans"
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- User usage table
-- Users can view, insert, and update their own usage records
-- ----------------------------------------------------------------------------
ALTER TABLE "user_usage" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON "user_usage";
CREATE POLICY "Users can view own usage" ON "user_usage"
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own usage" ON "user_usage";
CREATE POLICY "Users can insert own usage" ON "user_usage"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON "user_usage";
CREATE POLICY "Users can update own usage" ON "user_usage"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Marketing events table
-- INSERT: allow anon (pre-signup tracking) and authenticated
-- SELECT: users can only see their own events (user_id = auth.uid())
-- ----------------------------------------------------------------------------
ALTER TABLE "marketing_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert marketing events" ON "marketing_events";
DROP POLICY IF EXISTS "Users can insert own or anonymous marketing events" ON "marketing_events";
CREATE POLICY "Users can insert own or anonymous marketing events" ON "marketing_events"
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own marketing events" ON "marketing_events";
CREATE POLICY "Users can view own marketing events" ON "marketing_events"
  FOR SELECT USING (user_id = auth.uid());
