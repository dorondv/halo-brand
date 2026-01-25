-- Update subscription plan prices and features
UPDATE "subscription_plans" 
SET 
  "price_monthly" = CASE 
    WHEN "plan_key" = 'basic' THEN 29.00
    WHEN "plan_key" = 'pro' THEN 59.00
    WHEN "plan_key" = 'business' THEN 99.00
    ELSE "price_monthly"
  END,
  "price_annual" = CASE 
    WHEN "plan_key" = 'basic' THEN 276.00
    WHEN "plan_key" = 'pro' THEN 564.00
    WHEN "plan_key" = 'business' THEN 948.00
    ELSE "price_annual"
  END,
  "name_en" = CASE 
    WHEN "plan_key" = 'business' THEN 'Gold'
    ELSE "name_en"
  END,
  "name_he" = CASE 
    WHEN "plan_key" = 'business' THEN 'זהב'
    ELSE "name_he"
  END,
  "max_brands" = CASE 
    WHEN "plan_key" = 'basic' THEN 1
    WHEN "plan_key" = 'pro' THEN 10
    WHEN "plan_key" = 'business' THEN 50
    ELSE "max_brands"
  END,
  "max_social_accounts" = CASE 
    WHEN "plan_key" = 'basic' THEN 7
    WHEN "plan_key" = 'pro' THEN 70
    WHEN "plan_key" = 'business' THEN 350
    ELSE "max_social_accounts"
  END,
  "max_posts_per_month" = CASE 
    WHEN "plan_key" = 'basic' THEN 30
    WHEN "plan_key" = 'pro' THEN 300
    WHEN "plan_key" = 'business' THEN 1500
    ELSE "max_posts_per_month"
  END
WHERE "plan_key" IN ('basic', 'pro', 'business');


