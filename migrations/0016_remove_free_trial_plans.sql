-- Remove standalone free/trial plans from all accounts.
-- Coupon trials (is_trial_coupon) are migrated to paid plan_type pro.

-- Migrate coupon trials from legacy plan_type=trial to pro
UPDATE "subscriptions"
SET
  "plan_type" = 'pro',
  "status" = 'trialing',
  "updated_at" = NOW()
WHERE "is_trial_coupon" = true
  AND "plan_type" = 'trial';

-- Expire all free-plan and non-coupon trial subscriptions
UPDATE "subscriptions"
SET
  "status" = 'expired',
  "end_date" = COALESCE("end_date", NOW()),
  "updated_at" = NOW()
WHERE "plan_type" = 'free'
   OR "status" = 'free'
   OR ("plan_type" = 'trial' AND "is_trial_coupon" = false)
   OR ("is_free_access" = true AND "plan_type" = 'free');

-- Clear legacy free-access flags on expired rows
UPDATE "subscriptions"
SET
  "is_free_access" = false,
  "updated_at" = NOW()
WHERE "is_free_access" = true;

COMMENT ON COLUMN "subscriptions"."plan_type" IS 'basic | pro | business (legacy free/trial values migrated away)';
