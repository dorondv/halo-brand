-- Add billing cycle to subscriptions table
ALTER TABLE "subscriptions" 
ADD COLUMN IF NOT EXISTS "billing_cycle" VARCHAR(20) DEFAULT 'monthly' NOT NULL;

-- Add annual pricing to subscription_plans table
ALTER TABLE "subscription_plans" 
ADD COLUMN IF NOT EXISTS "price_annual" numeric(10,2);

-- Update existing subscription plans with annual pricing
UPDATE "subscription_plans" 
SET "price_annual" = CASE 
  WHEN "plan_key" = 'basic' THEN 276.00
  WHEN "plan_key" = 'pro' THEN 564.00
  WHEN "plan_key" = 'business' THEN 948.00
  ELSE NULL
END
WHERE "price_annual" IS NULL;

