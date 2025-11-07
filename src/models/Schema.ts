import {
  boolean,
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
