import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  server: {
    ARCJET_KEY: z.string().startsWith('ajkey_').optional(),
    DATABASE_URL: z.string().min(1),
    ADMIN_EMAIL: z.string().email().optional(), // Admin email for admin access control
    GETLATE_API_URL: z.string().url().optional(), // Optional, defaults to production API
    GETLATE_SERVICE_API_KEY: z.string().min(1).optional(), // Service account API key for auto-setup
    OPENAI_API_KEY: z.string().min(1).optional(), // OpenAI API key for AI features
    PAYPAL_CLIENT_ID: z.string().min(1).optional(), // PayPal Client ID for subscriptions
    PAYPAL_CLIENT_SECRET: z.string().min(1).optional(), // PayPal Client Secret
    PAYPAL_MODE: z.enum(['sandbox', 'live']).optional().default('sandbox'), // PayPal environment mode
    PAYPAL_BASIC_PLAN_MONTHLY: z.string().optional(), // PayPal Basic Plan Monthly ID
    PAYPAL_BASIC_PLAN_ANNUAL: z.string().optional(), // PayPal Basic Plan Annual ID
    PAYPAL_PRO_PLAN_MONTHLY: z.string().optional(), // PayPal Pro Plan Monthly ID
    PAYPAL_PRO_PLAN_ANNUAL: z.string().optional(), // PayPal Pro Plan Annual ID
    PAYPAL_GOLD_PLAN_MONTHLY: z.string().optional(), // PayPal Gold Plan Monthly ID
    PAYPAL_GOLD_PLAN_ANNUAL: z.string().optional(), // PayPal Gold Plan Annual ID
    SOCIAL_VAULT: z.string().min(1).optional(), // SocialVault API key for fetching comments
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().min(1),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(), // Google Analytics Measurement ID (G-XXXXXXXXXX)
    NEXT_PUBLIC_GTM_CONTAINER_ID: z.string().optional(), // Google Tag Manager Container ID (GTM-XXXXXXX)
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  // You need to destructure all the keys manually
  runtimeEnv: {
    ARCJET_KEY: process.env.ARCJET_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    GETLATE_API_URL: process.env.GETLATE_API_URL,
    GETLATE_SERVICE_API_KEY: process.env.GETLATE_SERVICE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_MODE: process.env.PAYPAL_MODE,
    PAYPAL_BASIC_PLAN_MONTHLY: process.env.PAYPAL_BASIC_PLAN_MONTHLY,
    PAYPAL_BASIC_PLAN_ANNUAL: process.env.PAYPAL_BASIC_PLAN_ANNUAL,
    PAYPAL_PRO_PLAN_MONTHLY: process.env.PAYPAL_PRO_PLAN_MONTHLY,
    PAYPAL_PRO_PLAN_ANNUAL: process.env.PAYPAL_PRO_PLAN_ANNUAL,
    PAYPAL_GOLD_PLAN_MONTHLY: process.env.PAYPAL_GOLD_PLAN_MONTHLY,
    PAYPAL_GOLD_PLAN_ANNUAL: process.env.PAYPAL_GOLD_PLAN_ANNUAL,
    SOCIAL_VAULT: process.env.SOCIAL_VAULT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GTM_CONTAINER_ID: process.env.NEXT_PUBLIC_GTM_CONTAINER_ID,
    NODE_ENV: process.env.NODE_ENV,
  },
});
