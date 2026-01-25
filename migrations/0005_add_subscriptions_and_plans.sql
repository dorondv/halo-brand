-- ============================================================================
-- Add Subscriptions and Subscription Plans Tables
-- ============================================================================
-- This migration creates the subscriptions, billing_history, payment_webhooks,
-- coupons, and subscription_plans tables for PayPal integration.
-- ============================================================================

-- Subscription Plans table (Basic, Pro, Business)
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_key" varchar(50) UNIQUE NOT NULL, -- 'basic', 'pro', 'business'
	"name_he" text NOT NULL,
	"name_en" text NOT NULL,
	"description_he" text,
	"description_en" text,
	"price_monthly" numeric(10,2) NOT NULL, -- Price in USD
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"max_brands" integer, -- NULL = unlimited
	"max_social_accounts" integer, -- NULL = unlimited
	"max_posts_per_month" integer, -- NULL = unlimited
	"features" jsonb, -- Array of feature keys
	"paypal_plan_id" text, -- PayPal plan ID for this plan
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_type" varchar(20) NOT NULL, -- 'basic' | 'pro' | 'business' | 'free' | 'trial'
	"status" varchar(20) NOT NULL, -- 'trialing' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'free'
	"paypal_subscription_id" text UNIQUE,
	"paypal_plan_id" text, -- PayPal plan ID
	"start_date" timestamp NOT NULL,
	"end_date" timestamp, -- Expiration date for free/trial subscriptions
	"trial_end_date" timestamp, -- For trial period
	"price" numeric(10,2) NOT NULL, -- Store actual price paid
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"coupon_code" text, -- Coupon code used (e.g., "tryout30")
	"coupon_id" uuid,
	"is_free_access" boolean DEFAULT false NOT NULL,
	"is_trial_coupon" boolean DEFAULT false NOT NULL,
	"granted_by_admin_id" uuid, -- Admin user ID who granted free access
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);

-- Billing history table
CREATE TABLE IF NOT EXISTS "billing_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"paypal_transaction_id" text UNIQUE,
	"paypal_sale_id" text, -- PayPal sale ID (for refund API)
	"amount" numeric(10,2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"status" varchar(30) NOT NULL, -- 'paid' | 'pending' | 'failed' | 'refunded' | 'partially_refunded'
	"payment_date" timestamp NOT NULL,
	"refunded_amount" numeric(10,2),
	"refunded_date" timestamp,
	"refund_reason" text,
	"invoice_url" text, -- Link to invoice PDF
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Payment webhook table
CREATE TABLE IF NOT EXISTS "payment_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paypal_event_id" text UNIQUE NOT NULL,
	"event_type" text NOT NULL, -- 'BILLING.SUBSCRIPTION.CREATED' | 'BILLING.SUBSCRIPTION.CANCELLED' | etc.
	"payload" jsonb NOT NULL, -- Full webhook payload
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Coupon table
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text UNIQUE NOT NULL, -- e.g., "tryout30", "tryout7", "tryout14"
	"trial_days" integer NOT NULL, -- Number of free trial days
	"description" text, -- Description of the trial offer
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp, -- Optional expiration date for coupon validity
	"max_uses" integer, -- Maximum number of times coupon can be used
	"current_uses" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Foreign key constraints
DO $$
BEGIN
	-- Subscriptions -> Users
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_users_id_fk'
	) THEN
		ALTER TABLE "subscriptions" 
			ADD CONSTRAINT "subscriptions_user_id_users_id_fk" 
			FOREIGN KEY ("user_id") 
			REFERENCES "public"."users"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;

	-- Subscriptions -> Subscription Plans (via plan_type reference)
	-- Note: This is a logical reference, not a foreign key since plan_type is a string

	-- Subscriptions -> Coupons
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_coupon_id_coupons_id_fk'
	) THEN
		ALTER TABLE "subscriptions" 
			ADD CONSTRAINT "subscriptions_coupon_id_coupons_id_fk" 
			FOREIGN KEY ("coupon_id") 
			REFERENCES "public"."coupons"("id") 
			ON DELETE SET NULL 
			ON UPDATE NO ACTION;
	END IF;

	-- Billing History -> Subscriptions
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'billing_history_subscription_id_subscriptions_id_fk'
	) THEN
		ALTER TABLE "billing_history" 
			ADD CONSTRAINT "billing_history_subscription_id_subscriptions_id_fk" 
			FOREIGN KEY ("subscription_id") 
			REFERENCES "public"."subscriptions"("id") 
			ON DELETE CASCADE 
			ON UPDATE NO ACTION;
	END IF;
END $$;

-- Insert default subscription plans
INSERT INTO "subscription_plans" (
	"plan_key", 
	"name_he", 
	"name_en", 
	"description_he", 
	"description_en", 
	"price_monthly", 
	"currency",
	"max_brands",
	"max_social_accounts",
	"max_posts_per_month",
	"features",
	"display_order"
) VALUES
(
	'basic',
	'בסיסית',
	'Basic',
	'לפרילנסרים ויוצרים שרק מתחילים.',
	'For freelancers and creators just starting out.',
	15.00,
	'USD',
	1,
	5,
	50,
	'["content_board", "basic_analytics"]'::jsonb,
	3
),
(
	'pro',
	'פרו',
	'Pro',
	'לעסקים קטנים וצוותי שיווק.',
	'For small businesses and marketing teams.',
	35.00,
	'USD',
	5,
	25,
	NULL, -- unlimited
	'["content_board", "basic_analytics", "advanced_analytics", "sentiment_analysis", "team_collaboration_3"]'::jsonb,
	2
),
(
	'business',
	'עסקים',
	'Business',
	'לסוכנויות ועסקים גדולים.',
	'For agencies and large businesses.',
	80.00,
	'USD',
	NULL, -- unlimited
	NULL, -- unlimited
	NULL, -- unlimited
	'["content_board", "basic_analytics", "advanced_analytics", "sentiment_analysis", "team_collaboration_10", "custom_report_export", "dedicated_support", "api_access"]'::jsonb,
	1
)
ON CONFLICT ("plan_key") DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_type_idx" ON "subscriptions"("plan_type");
CREATE INDEX IF NOT EXISTS "billing_history_subscription_id_idx" ON "billing_history"("subscription_id");
CREATE INDEX IF NOT EXISTS "payment_webhooks_processed_idx" ON "payment_webhooks"("processed");
CREATE INDEX IF NOT EXISTS "subscription_plans_plan_key_idx" ON "subscription_plans"("plan_key");

-- Add comments for documentation
COMMENT ON TABLE "subscription_plans" IS 'Available subscription plans (Basic, Pro, Business)';
COMMENT ON TABLE "subscriptions" IS 'User subscription records';
COMMENT ON TABLE "billing_history" IS 'Payment history for subscriptions';
COMMENT ON TABLE "payment_webhooks" IS 'PayPal webhook events log';
COMMENT ON TABLE "coupons" IS 'Trial and promotional coupon codes';

