import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    const dotenvModule = await import('dotenv');
    if (dotenvModule && typeof dotenvModule.config === 'function') {
      dotenvModule.config({ path: envPath });
    }
  } catch {
    // If dotenv isn't installed, ignore
  }
}

// Accept multiple possible env var names used across projects
const SUPABASE_URL
  = process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL2
    || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const SUPABASE_KEY
  = process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\nMissing Supabase credentials.\nPlease set environment variables (one of):');
  console.error('  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  console.error('and');
  console.error('  SUPABASE_SERVICE_KEY (recommended) or SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nYou can create a .env file in the project root with these values, for example:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=your-service-role-key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanup() {
  console.log('Cleaning up demo dashboard data...');

  // Find the demo user by email
  const { data: demoUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'demo@hello.brand')
    .single();

  if (userError || !demoUser) {
    console.log('⚠️  Demo user not found. Nothing to clean up.');
    return;
  }

  const userId = demoUser.id;
  console.log(`Found demo user with ID: ${userId}`);

  // Get post IDs for this user (needed for analytics and scheduled posts)
  const { data: userPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', userId);

  const postIds = userPosts?.map(p => p.id) || [];

  // Get counts before deletion
  const postsCount = postIds.length;

  const { count: analyticsCount } = await supabase
    .from('post_analytics')
    .select('*', { count: 'exact', head: true })
    .in('post_id', postIds);

  const { count: accountsCount } = await supabase
    .from('social_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: brandsCount } = await supabase
    .from('brands')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: scheduledCount } = await supabase
    .from('scheduled_posts')
    .select('*', { count: 'exact', head: true })
    .in('post_id', postIds);

  // Delete in order (respecting foreign key constraints)
  // 1. Delete scheduled_posts first (references posts)
  if (scheduledCount && scheduledCount > 0 && postIds.length > 0) {
    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .in('post_id', postIds);
    if (error) {
      console.error('Error deleting scheduled_posts:', error.message);
    } else {
      console.log(`✅ Deleted ${scheduledCount} scheduled post(s)`);
    }
  }

  // 2. Delete post_analytics (references posts)
  if (analyticsCount && analyticsCount > 0 && postIds.length > 0) {
    const { error } = await supabase
      .from('post_analytics')
      .delete()
      .in('post_id', postIds);
    if (error) {
      console.error('Error deleting post_analytics:', error.message);
    } else {
      console.log(`✅ Deleted ${analyticsCount} analytics entr${analyticsCount === 1 ? 'y' : 'ies'}`);
    }
  }

  // 3. Delete posts (references users and brands)
  if (postsCount && postsCount > 0) {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.error('Error deleting posts:', error.message);
    } else {
      console.log(`✅ Deleted ${postsCount} post(s)`);
    }
  }

  // 4. Delete social_accounts (references users and brands)
  if (accountsCount && accountsCount > 0) {
    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.error('Error deleting social_accounts:', error.message);
    } else {
      console.log(`✅ Deleted ${accountsCount} social account(s)`);
    }
  }

  // 5. Delete brands (references users)
  if (brandsCount && brandsCount > 0) {
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.error('Error deleting brands:', error.message);
    } else {
      console.log(`✅ Deleted ${brandsCount} brand(s)`);
    }
  }

  // 6. Delete the demo user
  const { error: deleteUserError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteUserError) {
    console.error('Error deleting demo user:', deleteUserError.message);
    process.exit(1);
  } else {
    console.log('✅ Deleted demo user');
  }

  console.log('\n✅ Cleanup completed successfully.');
  console.log('All demo data has been removed from the database.');
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err?.message || err);
  process.exit(1);
});
