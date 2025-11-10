import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';

// Environment variables are loaded by dotenv-cli before this script runs.
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
  console.error('  SUPABASE_SERVICE_KEY (REQUIRED for admin operations) or SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nYou can create a .env file in the project root with these values, for example:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=your-service-role-key');
  process.exit(1);
}

// Warn if using anon key instead of service key
if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_KEY) {
  console.warn('\n⚠️  WARNING: Using ANON_KEY instead of SERVICE_KEY.');
  console.warn('Admin operations (deleting auth users) require SERVICE_KEY.');
  console.warn('Please set SUPABASE_SERVICE_KEY in your .env file.\n');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper function to ask for user confirmation
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

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
  // Note: Getlate profiles are shared and not deleted when brands are removed
  if (brandsCount && brandsCount > 0) {
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.error('Error deleting brands:', error.message);
    } else {
      console.log(`✅ Deleted ${brandsCount} brand(s)`);
      console.log('   (Getlate profiles are preserved for reuse)');
    }
  }

  // 6. Delete settings (references users)
  const { count: settingsCount } = await supabase
    .from('settings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (settingsCount && settingsCount > 0) {
    const { error } = await supabase
      .from('settings')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.error('Error deleting settings:', error.message);
    } else {
      console.log(`✅ Deleted settings record`);
    }
  }

  // 7. Ask if user wants to delete the demo user
  console.log('\n📊 Summary of data to be deleted:');
  console.log(`   - ${postsCount} post(s)`);
  console.log(`   - ${analyticsCount || 0} analytics entr${analyticsCount === 1 ? 'y' : 'ies'}`);
  console.log(`   - ${scheduledCount || 0} scheduled post(s)`);
  console.log(`   - ${accountsCount || 0} social account(s)`);
  console.log(`   - ${brandsCount || 0} brand(s)`);
  console.log(`   - 1 user record (demo@hello.brand)`);

  const shouldDeleteUser = await askQuestion('\n❓ Do you want to delete the demo user? (yes/no): ');

  if (shouldDeleteUser !== 'yes' && shouldDeleteUser !== 'y') {
    console.log('\n⚠️  User deletion cancelled. Only data was cleaned up, user record remains.');
    console.log('✅ Cleanup completed (user preserved).');
    return;
  }

  // Delete the demo user from public.users
  const { error: deleteUserError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteUserError) {
    console.error('Error deleting demo user from public.users:', deleteUserError.message);
    process.exit(1);
  } else {
    console.log('✅ Deleted demo user from public.users');
  }

  // 8. Delete the auth user from auth.users (requires service role)
  try {
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const demoAuthUser = authUsers?.users?.find(u => u.email === 'demo@hello.brand');

    if (demoAuthUser) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(demoAuthUser.id);
      if (deleteAuthError) {
        console.warn('⚠️  Could not delete auth user (may require service role):', deleteAuthError.message);
        console.warn('   The auth user may still exist in auth.users table.');
      } else {
        console.log('✅ Deleted demo user from auth.users');
      }
    } else {
      console.log('ℹ️  Auth user not found (may have been already deleted)');
    }
  } catch (err) {
    console.warn('⚠️  Could not delete auth user:', err?.message || err);
    console.warn('   This requires SERVICE_KEY. The auth user may still exist in auth.users table.');
  }

  console.log('\n✅ Cleanup completed successfully.');
  console.log('All demo data has been removed from the database.');
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err?.message || err);
  process.exit(1);
});
