import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  plan: text('plan').default('free').notNull(),
  name: text('name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  idNumber: text('id_number'),
  avatarUrl: text('avatar_url'), // User avatar extracted from OAuth provider metadata or auth.users
  provider: varchar('provider', { length: 50 }), // 'email', 'google', 'facebook', 'twitter', 'github', 'linkedin', etc.
  isActive: boolean('is_active').default(true).notNull(),
  // Marketing / UTM fields (first source tracking)
  utmSource: text('utm_source'), // First UTM source
  utmMedium: text('utm_medium'), // First UTM medium
  utmCampaign: text('utm_campaign'), // First UTM campaign
  utmTerm: text('utm_term'), // First UTM term
  utmContent: text('utm_content'), // First UTM content
  firstReferrer: text('first_referrer'), // First referrer URL
  firstLandingUrl: text('first_landing_url'), // First landing page URL
  // Geo fields (rough geo via timezone/lang + IP)
  geoCountry: text('geo_country'), // Detected country (from IP or timezone/lang)
  geoTz: text('geo_tz'), // Timezone (e.g., "Asia/Jerusalem")
  geoLang: text('geo_lang'), // Browser language (e.g., "he-IL")
  geoCityApprox: text('geo_city_approx'), // Approximate city (if derivable)
  // Business fields
  cancelDate: timestamp('cancel_date', { mode: 'date' }), // When subscription was cancelled
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Settings table for user preferences
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  language: text('language').default('he').notNull(),
  timezone: text('timezone').default('Asia/Jerusalem').notNull(),
  country: text('country').default('il').notNull(),
  darkMode: boolean('dark_mode').default(false).notNull(), // false = light mode, true = dark mode
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Brands table
export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Social accounts table
export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 50 }).notNull(), // 'twitter', 'facebook', 'instagram', etc.
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  accountName: text('account_name').notNull(),
  accountId: text('account_id').notNull(),
  platformSpecificData: jsonb('platform_specific_data'),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Posts table
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  aiCaption: text('ai_caption'),
  hashtags: text('hashtags').array(),
  mediaType: varchar('media_type', { length: 20 }).default('text'), // 'text', 'image', 'video'
  metadata: jsonb('metadata'), // For platform-specific data
  status: varchar('status', { length: 20 }).default('draft').notNull(), // 'draft', 'scheduled', 'published', 'failed'
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Scheduled posts table
export const scheduledPosts = pgTable('scheduled_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  socialAccountId: uuid('social_account_id').references(() => socialAccounts.id, { onDelete: 'cascade' }).notNull(),
  scheduledFor: timestamp('scheduled_for', { mode: 'date' }).notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'published', 'failed'
  errorDetails: jsonb('error_details'),
  platformResponse: jsonb('platform_response'),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Post analytics table
export const postAnalytics = pgTable('post_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  likes: integer('likes'),
  comments: integer('comments'),
  shares: integer('shares'),
  impressions: integer('impressions'),
  date: timestamp('date', { mode: 'date' }).notNull(),
  metadata: jsonb('metadata'),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Coupon table (defined before subscriptions to avoid forward reference)
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(), // e.g., "tryout30", "tryout7", "tryout14"
  trialDays: integer('trial_days').notNull(), // Number of free trial days
  description: text('description'), // Description of the trial offer
  validFrom: timestamp('valid_from', { mode: 'date' }).defaultNow().notNull(),
  validUntil: timestamp('valid_until', { mode: 'date' }), // Optional expiration date for coupon validity
  maxUses: integer('max_uses'), // Maximum number of times coupon can be used
  currentUses: integer('current_uses').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Subscription Plans table
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  planKey: varchar('plan_key', { length: 50 }).unique().notNull(), // 'basic', 'pro', 'business'
  nameHe: text('name_he').notNull(),
  nameEn: text('name_en').notNull(),
  descriptionHe: text('description_he'),
  descriptionEn: text('description_en'),
  priceMonthly: doublePrecision('price_monthly').notNull(), // Price in USD
  priceAnnual: doublePrecision('price_annual'), // Annual price in USD (total for year)
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
  maxBrands: integer('max_brands'), // NULL = unlimited
  maxSocialAccounts: integer('max_social_accounts'), // NULL = unlimited
  maxPostsPerMonth: integer('max_posts_per_month'), // NULL = unlimited
  features: jsonb('features'), // Array of feature keys
  paypalPlanId: text('paypal_plan_id'), // PayPal plan ID for this plan
  isActive: boolean('is_active').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Subscription table
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  planType: varchar('plan_type', { length: 20 }).notNull(), // 'basic' | 'pro' | 'business' | 'free' | 'trial'
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly').notNull(), // 'monthly' | 'annual'
  status: varchar('status', { length: 20 }).notNull(), // 'trialing' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'free'
  paypalSubscriptionId: text('paypal_subscription_id').unique(),
  paypalPlanId: text('paypal_plan_id'), // PayPal plan ID
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }), // Expiration date for free/trial subscriptions
  trialEndDate: timestamp('trial_end_date', { mode: 'date' }), // For trial period
  price: doublePrecision('price').notNull(), // Store actual price paid
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
  couponCode: text('coupon_code'), // Coupon code used (e.g., "tryout30")
  couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
  isFreeAccess: boolean('is_free_access').default(false).notNull(),
  isTrialCoupon: boolean('is_trial_coupon').default(false).notNull(),
  grantedByAdminId: uuid('granted_by_admin_id'), // Admin user ID who granted free access
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Billing history table
export const billingHistory = pgTable('billing_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'cascade' }).notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  paypalTransactionId: text('paypal_transaction_id').unique(),
  paypalSaleId: text('paypal_sale_id'), // PayPal sale ID (for refund API)
  amount: doublePrecision('amount').notNull(),
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
  status: varchar('status', { length: 30 }).notNull(), // 'paid' | 'pending' | 'failed' | 'refunded' | 'partially_refunded'
  paymentDate: timestamp('payment_date', { mode: 'date' }).notNull(),
  refundedAmount: doublePrecision('refunded_amount'),
  refundedDate: timestamp('refunded_date', { mode: 'date' }),
  refundReason: text('refund_reason'),
  invoiceUrl: text('invoice_url'), // Link to invoice PDF
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Payment webhook table
export const paymentWebhooks = pgTable('payment_webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  paypalEventId: text('paypal_event_id').unique().notNull(),
  eventType: text('event_type').notNull(), // 'BILLING.SUBSCRIPTION.CREATED' | 'BILLING.SUBSCRIPTION.CANCELLED' | etc.
  payload: jsonb('payload').notNull(), // Full webhook payload
  processed: boolean('processed').default(false).notNull(),
  processedAt: timestamp('processed_at', { mode: 'date' }),
  error: text('error'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Marketing events table
export const marketingEvents = pgTable('marketing_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // pageview, signup_start, signup_complete, lead_submit, purchase_complete
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  url: text('url'),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'), // IP address (for geo detection)
  // UTM parameters
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmTerm: text('utm_term'),
  utmContent: text('utm_content'),
  // Click IDs
  gclid: text('gclid'), // Google click ID
  fbclid: text('fbclid'), // Facebook click ID
  msclkid: text('msclkid'), // Microsoft click ID
  ttclid: text('ttclid'), // TikTok click ID
  // Geo data
  timezone: text('timezone'),
  language: text('language'),
  country: text('country'), // ISO country code (2 chars)
  // Business fields
  purchaseAmount: doublePrecision('purchase_amount'),
  currency: varchar('currency', { length: 10 }),
  revenueTotal: doublePrecision('revenue_total'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Relations
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  coupon: one(coupons, {
    fields: [subscriptions.couponId],
    references: [coupons.id],
  }),
  billingHistory: many(billingHistory),
}));

export const billingHistoryRelations = relations(billingHistory, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [billingHistory.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const couponsRelations = relations(coupons, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  marketingEvents: many(marketingEvents),
}));

export const marketingEventsRelations = relations(marketingEvents, ({ one }) => ({
  user: one(users, {
    fields: [marketingEvents.userId],
    references: [users.id],
  }),
}));
