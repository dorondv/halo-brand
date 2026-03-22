-- ============================================================================
-- payment_webhooks: Add explicit RLS policy (satisfies Security Advisor)
-- ============================================================================
-- RLS was enabled with no policies - service role bypasses RLS for webhooks.
-- Add explicit "deny all" policy for anon/authenticated to document intent
-- and resolve "RLS Enabled No Policy" linter finding.
-- ============================================================================

DROP POLICY IF EXISTS "No direct client access - service role only" ON "payment_webhooks";
CREATE POLICY "No direct client access - service role only" ON "payment_webhooks"
  FOR ALL
  USING (false)
  WITH CHECK (false);
