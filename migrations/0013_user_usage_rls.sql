-- ============================================================================
-- Ensure RLS on user_usage table
-- ============================================================================
-- user_usage had RLS in 0009; this migration ensures consistent policy format
-- and applies RLS if 0009 was skipped. Idempotent: DROP IF EXISTS before CREATE.
-- ============================================================================

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
