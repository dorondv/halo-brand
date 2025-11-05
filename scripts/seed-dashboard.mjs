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
  console.error('  SUPABASE_SERVICE_KEY (recommended) or SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nYou can create a .env file in the project root with these values, for example:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=your-service-role-key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  console.log('Seeding comprehensive dashboard data...');

  // Remove old demo data (best effort)
  await supabase.from('scheduled_posts').delete().neq('id', '');
  await supabase.from('posts').delete().neq('id', '');
  await supabase.from('social_accounts').delete().neq('id', '');
  await supabase.from('brands').delete().neq('id', '');
  await supabase.from('users').delete().neq('id', '');

  // Insert a demo user
  let users;
  let usersError;
  {
    const res = await supabase.from('users').insert([
      { email: 'demo@hello.brand', plan: 'trial', name: 'Demo User' },
    ]).select();
    users = res.data;
    usersError = res.error;
  }

  if (usersError) {
    // If user already exists (unique constraint), try to fetch it instead of failing
    const msg = String(usersError.message || usersError || '');
    if (msg.toLowerCase().includes('duplicate') || msg.includes('unique')) {
      console.warn('Demo user already exists, attempting to load existing user...');
      const { data: existingUsers, error: fetchErr } = await supabase.from('users').select().eq('email', 'demo@hello.brand').limit(1);
      if (fetchErr) {
        console.error('Failed to fetch existing demo user after duplicate error:', fetchErr.message || fetchErr);
        process.exit(1);
      }
      if (existingUsers && existingUsers.length) {
        users = existingUsers; // overwrite local variable
      } else {
        console.error('No existing user found after duplicate error; aborting.');
        process.exit(1);
      }
    } else {
      console.error('Failed to insert demo user:', usersError.message || usersError);
      process.exit(1);
    }
  }

  const userId = users && users.length ? users[0].id : null;
  if (!userId) {
    console.error('No user id returned from insert; aborting seed.');
    process.exit(1);
  }

  // Insert brands (companies)
  const brandsData = [
    { name: 'Halo Brand', description: 'Main brand for social media marketing' },
    { name: 'Demo Corp', description: 'Secondary brand for testing' },
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
        created_at: `${dateStr}T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
        // Store analytics data separately for post_analytics insertion
        _analytics: {
          impressions,
          likes,
          comments,
          shares,
          date: `${dateStr}T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
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
      created_at: `${dateStr}T12:00:00.000Z`,
      // Store analytics data separately for post_analytics insertion
      _analytics: {
        impressions,
        likes,
        comments,
        shares,
        date: `${dateStr}T12:00:00.000Z`,
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
