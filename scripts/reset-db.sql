-- ============================================================================
-- Database Reset Script
-- ============================================================================
-- WARNING: This will DELETE ALL DATA from all tables!
-- Use with caution. This script drops all tables and related objects.
-- After running this, you'll need to re-run migrations to recreate tables.
-- ============================================================================

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Drop all tables in correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS "post_analytics" CASCADE;
DROP TABLE IF EXISTS "scheduled_posts" CASCADE;
DROP TABLE IF EXISTS "posts" CASCADE;
DROP TABLE IF EXISTS "social_accounts" CASCADE;
DROP TABLE IF EXISTS "brands" CASCADE;
DROP TABLE IF EXISTS "settings" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Clear Drizzle migration tracking (if exists)
DROP TABLE IF EXISTS drizzle.__drizzle_migrations CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ All tables, functions, and triggers have been dropped.';
    RAISE NOTICE '📝 Next step: Run migrations to recreate tables: npm run db:migrate';
END $$;
