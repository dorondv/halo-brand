-- ============================================================================
-- Add Marketing Tracking Module
-- ============================================================================
-- This migration adds marketing/UTM tracking fields to users table and
-- creates the marketing_events table for tracking marketing events.
-- ============================================================================

-- Add marketing/UTM fields to users table
ALTER TABLE "users" 
  ADD COLUMN IF NOT EXISTS "utm_source" text,
  ADD COLUMN IF NOT EXISTS "utm_medium" text,
  ADD COLUMN IF NOT EXISTS "utm_campaign" text,
  ADD COLUMN IF NOT EXISTS "utm_term" text,
  ADD COLUMN IF NOT EXISTS "utm_content" text,
  ADD COLUMN IF NOT EXISTS "first_referrer" text,
  ADD COLUMN IF NOT EXISTS "first_landing_url" text,
  ADD COLUMN IF NOT EXISTS "geo_country" text,
  ADD COLUMN IF NOT EXISTS "geo_tz" text,
  ADD COLUMN IF NOT EXISTS "geo_lang" text,
  ADD COLUMN IF NOT EXISTS "geo_city_approx" text,
  ADD COLUMN IF NOT EXISTS "cancel_date" timestamp;

-- Create marketing_events table
CREATE TABLE IF NOT EXISTS "marketing_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" varchar(50) NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "url" text,
  "referrer" text,
  "user_agent" text,
  "ip_address" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_term" text,
  "utm_content" text,
  "gclid" text,
  "fbclid" text,
  "msclkid" text,
  "ttclid" text,
  "timezone" text,
  "language" text,
  "country" text,
  "purchase_amount" double precision,
  "currency" varchar(10),
  "revenue_total" double precision,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "marketing_events_event_type_idx" ON "marketing_events"("event_type");
CREATE INDEX IF NOT EXISTS "marketing_events_user_id_idx" ON "marketing_events"("user_id");
CREATE INDEX IF NOT EXISTS "marketing_events_utm_source_idx" ON "marketing_events"("utm_source");
CREATE INDEX IF NOT EXISTS "marketing_events_utm_campaign_idx" ON "marketing_events"("utm_campaign");
CREATE INDEX IF NOT EXISTS "marketing_events_country_idx" ON "marketing_events"("country");
CREATE INDEX IF NOT EXISTS "marketing_events_created_at_idx" ON "marketing_events"("created_at");
