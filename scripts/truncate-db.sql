-- ============================================================================
-- Database Truncate Script (Keep Structure, Remove Data)
-- ============================================================================
-- This script removes all data from tables but keeps the table structure.
-- Safer than dropping tables - preserves schema, indexes, constraints, etc.
-- ============================================================================

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Truncate all tables in correct order (respecting foreign key dependencies)
TRUNCATE TABLE "post_analytics" CASCADE;
TRUNCATE TABLE "scheduled_posts" CASCADE;
TRUNCATE TABLE "posts" CASCADE;
TRUNCATE TABLE "social_accounts" CASCADE;
TRUNCATE TABLE "brands" CASCADE;
TRUNCATE TABLE "settings" CASCADE;
TRUNCATE TABLE "users" CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset sequences (if any)
-- Note: UUID primary keys don't use sequences, but included for completeness

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ All table data has been removed. Table structures preserved.';
END $$;
