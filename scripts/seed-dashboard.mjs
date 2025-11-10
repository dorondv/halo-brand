import { createClient } from '@supabase/supabase-js';

// Environment variables are loaded by dotenv-cli before this script runs.
// Accept multiple possible env var names used across projects
const SUPABASE_URL
  = process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL2
    || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

// REQUIRE service key for admin operations
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL) {
  console.error('\n❌ Missing SUPABASE_URL environment variable.');
  console.error('Please set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your .env file.');
  console.error('\nExample:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_KEY environment variable.');
  console.error('This script requires SERVICE_KEY for admin operations (creating auth users).');
  console.error('\nPlease set SUPABASE_SERVICE_KEY in your .env file.');
  console.error('\nTo find your service key:');
  console.error('  1. Go to Supabase Dashboard → Project Settings → API');
  console.error('  2. Copy the "service_role" key (NOT the anon key)');
  console.error('  3. Add it to your .env file:');
  console.error('     SUPABASE_SERVICE_KEY=your-service-role-key-here');
  console.error('\n⚠️  WARNING: Never commit the service key to git!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log('Seeding comprehensive dashboard data...');
  console.log('Creating user via Supabase Auth (email provider) - trigger will fire automatically.\n');

  const demoEmail = 'demo@hello.brand';
  const demoPassword = 'testing123456'; // Temporary password for demo user
  const demoName = 'Demo User';

  console.log(`Demo user credentials:`);
  console.log(`  Email: ${demoEmail}`);
  console.log(`  Password: ${demoPassword}`);
  console.log(`  (This is a temporary demo account - change password after first login)\n`);

  // Remove old demo data (best effort)
  // First, try to delete auth user if it exists (requires service role)
  try {
    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
    const demoAuthUser = existingAuthUsers?.users?.find(u => u.email === demoEmail);
    if (demoAuthUser) {
      await supabase.auth.admin.deleteUser(demoAuthUser.id);
      console.log('✅ Removed existing auth user');
    }
  } catch (err) {
    console.warn('Could not delete existing auth user (may not exist):', err?.message || err);
  }

  // Clean up public tables - delete only demo user's data
  // Find demo user first to get their ID
  const { data: existingDemoUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', demoEmail)
    .maybeSingle();

  if (existingDemoUser) {
    const demoUserId = existingDemoUser.id;
    console.log('Found existing demo user, cleaning up their data...');

    // Delete in correct order (respecting foreign keys)
    const { data: userPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', demoUserId);
    const postIds = userPosts?.map(p => p.id) || [];

    if (postIds.length > 0) {
      await supabase.from('scheduled_posts').delete().in('post_id', postIds);
      await supabase.from('post_analytics').delete().in('post_id', postIds);
    }

    await supabase.from('posts').delete().eq('user_id', demoUserId);
    await supabase.from('social_accounts').delete().eq('user_id', demoUserId);
    await supabase.from('brands').delete().eq('user_id', demoUserId);
    await supabase.from('settings').delete().eq('user_id', demoUserId);
    await supabase.from('users').delete().eq('id', demoUserId);
    console.log('✅ Cleaned up existing demo user data');
  } else {
    console.log('No existing demo user found, proceeding with fresh seed');
  }

  // Create user via Supabase Auth (this will trigger the on_auth_user_created trigger)
  console.log('Creating user via Supabase Auth...');
  let authUser;
  let userId;

  // Check if user already exists in public.users
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', demoEmail)
    .maybeSingle();

  if (existingUser) {
    console.log('✅ User already exists in public.users, using existing user ID');
    userId = existingUser.id;

    // Verify auth user exists
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const existingAuthUser = authUsers?.users?.find(u => u.email === demoEmail);
      if (existingAuthUser) {
        authUser = existingAuthUser;
        console.log('✅ Auth user already exists');
      } else {
        // Create auth user if it doesn't exist
        const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
          email: demoEmail,
          password: demoPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            full_name: demoName,
            name: demoName,
          },
        });
        if (createError) {
          console.error('\n❌ Failed to create auth user');
          console.error('Error message:', createError.message);
          console.error('Error code:', createError.status || createError.code);
          console.error('Full error:', JSON.stringify(createError, null, 2));
          process.exit(1);
        }
        authUser = newAuthUser.user;
        userId = authUser.id;
        console.log('✅ Created new auth user');
      }
    } catch (err) {
      console.error('Error checking/creating auth user:', err?.message || err);
      process.exit(1);
    }
  } else {
    // Create new user via Auth Admin API
    console.log('Attempting to create auth user...');
    const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true, // Auto-confirm email so they can sign in
      user_metadata: {
        full_name: demoName,
        name: demoName,
      },
    });

    if (createError) {
      console.error('\n❌ Failed to create auth user');
      console.error('Error message:', createError.message);
      console.error('Error code:', createError.status || createError.code);
      console.error('Full error:', JSON.stringify(createError, null, 2));

      // Check if trigger exists
      console.error('\n💡 Troubleshooting:');
      console.error('The trigger is failing when executing. This is usually caused by:');
      console.error('1. The trigger function querying auth.identities before it exists');
      console.error('2. Missing error handling in the trigger function');
      console.error('\n🔧 Fix: Run this script in Supabase Dashboard → SQL Editor:');
      console.error('   scripts/fix-trigger-function.sql');
      console.error('\nThis will update the trigger function with better error handling.');
      console.error('\nAlternatively, check Supabase logs for the exact error:');
      console.error('   Dashboard → Logs → Postgres Logs');

      process.exit(1);
    }

    authUser = newAuthUser.user;
    userId = authUser.id;
    console.log('✅ Created auth user via Supabase Auth');

    // Wait a moment for the trigger to fire and create the public.users record
    console.log('Waiting for trigger to create public.users record...');
    let retries = 10;
    let publicUser = null;
    while (retries > 0 && !publicUser) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      const { data } = await supabase
        .from('users')
        .select('id, email, name, plan')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        publicUser = data;
        break;
      }
      retries--;
    }

    if (!publicUser) {
      console.error('Trigger did not create public.users record. Please verify the trigger exists.');
      console.log('To check trigger, run in Supabase Dashboard SQL Editor:');
      console.log('SELECT * FROM information_schema.triggers WHERE trigger_name = \'on_auth_user_created\';');
      process.exit(1);
    }

    console.log('✅ Trigger fired - public.users record created');
    console.log(`   User ID: ${publicUser.id}`);
    console.log(`   Email: ${publicUser.email}`);
    console.log(`   Name: ${publicUser.name}`);
    console.log(`   Plan: ${publicUser.plan}`);

    // Verify settings were created by trigger
    const { data: settings } = await supabase
      .from('settings')
      .select('user_id, language, timezone, country')
      .eq('user_id', userId)
      .maybeSingle();

    if (settings) {
      console.log('✅ Settings created by trigger');
      console.log(`   Language: ${settings.language}, Timezone: ${settings.timezone}, Country: ${settings.country}`);
    } else {
      console.warn('⚠️  Settings not found - trigger may not have created them. Creating manually...');
      const { error: settingsError } = await supabase.from('settings').upsert([
        {
          user_id: userId,
          language: 'he',
          timezone: 'Asia/Jerusalem',
          country: 'il',
          dark_mode: false,
        },
      ], {
        onConflict: 'user_id',
      });
      if (settingsError) {
        console.error('Failed to create settings:', settingsError.message || settingsError);
      } else {
        console.log('✅ Created settings manually');
      }
    }
  }

  // Update user plan to 'trial' for demo purposes
  // For demo@hello.brand, also set Getlate API key if available
  const updateData = { plan: 'trial', name: demoName };

  // Set Getlate API key for demo user if service key is available
  const getlateServiceKey = process.env.GETLATE_SERVICE_API_KEY;
  if (getlateServiceKey) {
    updateData.getlate_api_key = getlateServiceKey;
    console.log('✅ Setting Getlate API key for demo user');
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (updateError) {
    console.warn('Could not update user plan:', updateError.message || updateError);
  } else {
    console.log('✅ Updated user plan to "trial"');
  }

  // Insert brands (companies)
  // For demo@hello.brand, use the default Getlate profile ID
  const DEFAULT_GETLATE_PROFILE_ID = '690c738f2e6c6b55e66c14e6';

  const brandsData = [
    { name: 'Halo Brand', description: 'Main brand for social media marketing', getlate_profile_id: DEFAULT_GETLATE_PROFILE_ID },
    { name: 'Demo Corp', description: 'Secondary brand for testing', getlate_profile_id: null },
  ];

  const { data: brands, error: brandsError } = await supabase.from('brands').insert(
    brandsData.map(b => ({
      ...b,
      user_id: userId,
      logo_url: null,
    })),
  ).select();

  if (brandsError) {
    console.error('Failed to insert brands:', brandsError.message || brandsError);
    process.exit(1);
  }

  if (!brands || !Array.isArray(brands) || brands.length === 0) {
    console.error('No brands created; aborting seed.');
    process.exit(1);
  }

  const primaryBrandId = brands[0].id;
  const secondaryBrandId = brands.length > 1 ? brands[1].id : brands[0].id;

  // Insert social accounts (platforms) with follower counts, associated with brands
  // Store platform configuration with brand associations for later use in posts
  const platformsConfig = [
    { platform: 'youtube', account_name: 'Demo Channel', account_id: 'yt_demo', followers: 19186, brandId: primaryBrandId },
    { platform: 'facebook', account_name: 'Demo Page', account_id: 'fb_demo', followers: 21377, brandId: primaryBrandId },
    { platform: 'linkedin', account_name: 'Demo Company', account_id: 'li_demo', followers: 2899, brandId: primaryBrandId },
    { platform: 'tiktok', account_name: 'Demo Tok', account_id: 'tt_demo', followers: 5912, brandId: secondaryBrandId },
    { platform: 'x', account_name: 'Demo X', account_id: 'x_demo', followers: 3038, brandId: primaryBrandId },
    { platform: 'instagram', account_name: 'Demo IG', account_id: 'ig_demo', followers: 4210, brandId: secondaryBrandId },
  ];

  // platformsConfig is used directly below; avoid duplicate unused binding

  const { data: accounts, error: accountsError } = await supabase.from('social_accounts').insert(
    platformsConfig.map(p => ({
      platform: p.platform,
      account_name: p.account_name,
      account_id: p.account_id,
      user_id: userId,
      brand_id: p.brandId,
      access_token: 'demo-token',
      platform_specific_data: { followers: p.followers },
    })),
  ).select();

  if (accountsError) {
    console.error('Failed to insert social accounts:', accountsError.message || accountsError);
    process.exit(1);
  }

  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    console.error('No social accounts created; aborting seed.');
    process.exit(1);
  }

  // Generate posts across multiple dates (last 30 days for comprehensive date range testing)
  const now = new Date();
  const posts = [];

  // (removed unused platformFollowers mapping — follower counts are embedded
  // in platformsConfig and/or account platform_specific_data)

  // Generate posts for last 30 days, distributed across platforms
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const postDate = new Date(now);
    postDate.setDate(postDate.getDate() - dayOffset);
    const dateStr = postDate.toISOString().split('T')[0];

    // Create 1-2 posts per day across different platforms
    const postsPerDay = dayOffset % 3 === 0 ? 2 : 1;

    for (let i = 0; i < postsPerDay; i++) {
      const account = accounts[i % accounts.length];
      // platformKey not needed here; use account.platform when required

      // Vary impressions and engagement realistically
      const impressions = Math.floor(5000 + Math.random() * 50000);
      const engagement = Math.floor(impressions * (0.04 + Math.random() * 0.06)); // 4-10% engagement rate

      // Get brand_id from account (accounts already have brand_id from the insert)
      const brandId = account.brand_id || primaryBrandId;

      // Calculate individual engagement metrics
      const likes = Math.floor(engagement * 0.6); // 60% likes
      const comments = Math.floor(engagement * 0.25); // 25% comments
      const shares = Math.floor(engagement * 0.15); // 15% shares

      const postTimestamp = `${dateStr}T${String(10 + i).padStart(2, '0')}:00:00.000Z`;
      posts.push({
        user_id: userId,
        brand_id: brandId,
        content: `Demo post from ${account.account_name} - ${dateStr}`,
        image_url: null,
        ai_caption: null,
        hashtags: ['#demo', '#hello'],
        media_type: 'image',
        metadata: {
          platform: account.platform,
          date: dateStr,
        },
        status: 'published',
        updated_at: postTimestamp,
        created_at: postTimestamp,
        // Store analytics data separately for post_analytics insertion
        _analytics: {
          impressions,
          likes,
          comments,
          shares,
          date: postTimestamp,
        },
      });
    }
  }

  // Also add some older posts for last month range testing
  for (let dayOffset = 30; dayOffset < 60; dayOffset += 2) {
    const postDate = new Date(now);
    postDate.setDate(postDate.getDate() - dayOffset);
    const dateStr = postDate.toISOString().split('T')[0];

    const account = accounts[dayOffset % accounts.length];
    // platformKey not needed here; use account.platform when required

    const impressions = Math.floor(5000 + Math.random() * 50000);
    const engagement = Math.floor(impressions * (0.04 + Math.random() * 0.06));

    // Get brand_id from account (accounts already have brand_id from the insert)
    const brandId = account.brand_id || primaryBrandId;

    // Calculate individual engagement metrics
    const likes = Math.floor(engagement * 0.6); // 60% likes
    const comments = Math.floor(engagement * 0.25); // 25% comments
    const shares = Math.floor(engagement * 0.15); // 15% shares

    const postTimestamp = `${dateStr}T12:00:00.000Z`;
    posts.push({
      user_id: userId,
      brand_id: brandId,
      content: `Older demo post from ${account.account_name} - ${dateStr}`,
      image_url: null,
      ai_caption: null,
      hashtags: ['#demo'],
      media_type: 'image',
      metadata: {
        platform: account.platform,
        date: dateStr,
      },
      status: 'published',
      updated_at: postTimestamp,
      created_at: postTimestamp,
      // Store analytics data separately for post_analytics insertion
      _analytics: {
        impressions,
        likes,
        comments,
        shares,
        date: postTimestamp,
      },
    });
  }

  // Insert posts first (without _analytics field)
  const postsToInsert = posts.map(({ _analytics, ...post }) => post);
  const { data: insertedPosts, error: postsError } = await supabase
    .from('posts')
    .insert(postsToInsert)
    .select('id,created_at');

  if (postsError) {
    console.error('Failed to insert posts:', postsError.message || postsError);
    process.exit(1);
  }

  // Create post_analytics entries for each post
  const analyticsEntries = [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const insertedPost = insertedPosts[i];

    if (!insertedPost || !post._analytics) {
      continue;
    }

    // Create initial analytics entry at post creation time
    analyticsEntries.push({
      post_id: insertedPost.id,
      likes: post._analytics.likes,
      comments: post._analytics.comments,
      shares: post._analytics.shares,
      impressions: post._analytics.impressions,
      date: post._analytics.date,
      metadata: {
        platform: post.metadata?.platform,
      },
    });

    // Optionally create follow-up analytics entries (simulating data updates over time)
    // Create 2-3 additional entries over the next few days for growth tracking
    const numUpdates = Math.floor(Math.random() * 2) + 1; // 1-2 updates
    for (let update = 0; update < numUpdates; update++) {
      const updateDate = new Date(post._analytics.date);
      updateDate.setDate(updateDate.getDate() + update + 1); // Next day(s)

      // Simulate growth: impressions and engagement increase over time
      const growthFactor = 1 + (update * 0.1); // 10% growth per day
      const updatedImpressions = Math.floor(post._analytics.impressions * growthFactor);
      const updatedEngagement = Math.floor((post._analytics.likes + post._analytics.comments + post._analytics.shares) * growthFactor);

      analyticsEntries.push({
        post_id: insertedPost.id,
        likes: Math.floor(updatedEngagement * 0.6),
        comments: Math.floor(updatedEngagement * 0.25),
        shares: Math.floor(updatedEngagement * 0.15),
        impressions: updatedImpressions,
        date: updateDate.toISOString(),
        metadata: {
          platform: post.metadata?.platform,
        },
      });
    }
  }

  // Insert analytics entries
  if (analyticsEntries.length > 0) {
    const { error: analyticsError } = await supabase
      .from('post_analytics')
      .insert(analyticsEntries);

    if (analyticsError) {
      console.error('Failed to insert post analytics:', analyticsError.message || analyticsError);
      process.exit(1);
    }
  }

  console.log(`✅ Seeded ${brands.length} brand(s)`);
  console.log(`✅ Seeded ${accounts.length} social accounts`);
  console.log(`✅ Seeded ${posts.length} posts across ${accounts.length} platforms`);
  console.log(`✅ Seeded ${analyticsEntries.length} analytics entries (stored in post_analytics table)`);
  console.log('✅ Data covers last 60 days for comprehensive date range testing');
  console.log('Seeding completed successfully.');
}

seed().catch((err) => {
  console.error('Seeding failed:', err?.message || err);
  process.exit(1);
});
