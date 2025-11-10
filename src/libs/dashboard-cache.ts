import type { SupabaseClient } from '@supabase/supabase-js';
import { syncAnalyticsFromGetlate } from './analytics-sync';

/**
 * Get user's posts with analytics (no caching - real-time data)
 */
export async function getCachedPosts(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
  dateFrom: Date,
  dateTo: Date,
) {
  // Get all posts (include published, scheduled, and draft - we'll filter by date)
  // Note: Posts might be in 'scheduled' or 'draft' status but still have analytics
  let postsQuery = supabase
    .from('posts')
    .select('id,metadata,created_at,content,brand_id,getlate_post_id,status,platforms')
    .eq('user_id', userId)
    .in('status', ['published', 'scheduled', 'draft']); // Include all statuses

  if (brandId && brandId !== 'all') {
    postsQuery = postsQuery.eq('brand_id', brandId);
  }

  const { data: allPostsData, error: postsError } = await postsQuery.order('created_at', { ascending: false });

  // Log error for debugging (only in development)
  if (postsError && process.env.NODE_ENV === 'development') {
    console.error('Error fetching posts:', postsError);
  }

  if (!allPostsData || allPostsData.length === 0) {
    return { posts: [], analytics: [] };
  }

  // Get scheduled_posts data for these posts to find published/scheduled dates
  const { data: scheduledPostsData, error: scheduledError } = await supabase
    .from('scheduled_posts')
    .select('post_id,published_at,scheduled_for,status')
    .in('post_id', allPostsData.map(p => p.id));

  // Log error for debugging (only in development)
  if (scheduledError && process.env.NODE_ENV === 'development') {
    console.error('Error fetching scheduled posts:', scheduledError);
  }

  // Create a map of post_id -> published/scheduled date
  const publishedDateMap = new Map<string, Date>();
  for (const scheduled of scheduledPostsData || []) {
    const publishDate = scheduled.published_at || scheduled.scheduled_for;
    if (publishDate) {
      publishedDateMap.set(scheduled.post_id, new Date(publishDate));
    }
  }

  // Filter posts by date range (use published_at/scheduled_for if available, otherwise created_at)
  const postsData = allPostsData.filter((post) => {
    const publishDate = publishedDateMap.get(post.id) || new Date(post.created_at);
    return publishDate >= dateFrom && publishDate <= dateTo;
  });

  // Fetch analytics for ALL posts (not just filtered ones) - this ensures we get analytics
  // even if the post's publish date is outside the range but analytics date is within range
  // The date filtering will be done in the dashboard component
  const { data: analyticsData, error: analyticsError } = await supabase
    .from('post_analytics')
    .select('post_id,likes,comments,shares,impressions,date,metadata,platform')
    .in('post_id', allPostsData.map(p => p.id)) // Use allPostsData, not postsData
    .order('date', { ascending: false });

  // Log error for debugging (only in development)
  if (analyticsError && process.env.NODE_ENV === 'development') {
    console.error('Error fetching analytics:', analyticsError);
  }

  return {
    posts: postsData || [],
    analytics: analyticsData || [],
  };
}

/**
 * Get user's social accounts (no caching - real-time data)
 */
export async function getCachedAccounts(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
) {
  let accountsQuery = supabase
    .from('social_accounts')
    .select('id,platform,account_name,platform_specific_data,brand_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (brandId && brandId !== 'all') {
    accountsQuery = accountsQuery.eq('brand_id', brandId);
  }

  const { data: accountsData } = await accountsQuery;

  return accountsData || [];
}

/**
 * Background sync analytics from Getlate (non-blocking)
 * This should be called separately, not blocking the main page load
 * Note: Supabase client must be created outside the cache scope
 *
 * Rate Limit: 30 requests per hour per user (Getlate Analytics API)
 * Strategy: Fetch comprehensive data with pagination, but respect rate limits
 */
export async function syncAnalyticsInBackground(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
  options?: {
    dateFrom?: Date;
    dateTo?: Date;
  },
) {
  // Don't await - let it run in background
  (async () => {
    try {
      // Calculate date range: use provided dates or default to last 90 days for comprehensive data
      const toDate = options?.dateTo || new Date();
      const fromDate = options?.dateFrom || (() => {
        const date = new Date();
        date.setDate(date.getDate() - 90); // Extended to 90 days for better historical data
        return date;
      })();

      if (brandId && brandId !== 'all') {
        // Sync for specific brand
        await syncAnalyticsFromGetlate(supabase, userId, brandId, {
          fromDate: fromDate.toISOString().split('T')[0],
          toDate: toDate.toISOString().split('T')[0],
        });
      } else {
        // Sync for all brands with Getlate profiles
        // IMPORTANT: Rate limit is 30 req/hour, so we sync sequentially with delays
        // to avoid hitting the limit when syncing multiple brands
        const { data: brands } = await supabase
          .from('brands')
          .select('id, getlate_profile_id')
          .eq('user_id', userId)
          .not('getlate_profile_id', 'is', null);

        if (brands && brands.length > 0) {
          // Sync sequentially with small delays to respect rate limits
          // Each brand sync may make multiple paginated requests
          // Delay between brands: 2 seconds (allows ~30 brands/hour with pagination)
          for (let i = 0; i < brands.length; i++) {
            const brand = brands[i];
            if (!brand) {
              continue;
            }
            try {
              await syncAnalyticsFromGetlate(supabase, userId, brand.id, {
                fromDate: fromDate.toISOString().split('T')[0],
                toDate: toDate.toISOString().split('T')[0],
              });

              // Add delay between brands (except for the last one)
              if (i < brands.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
              }
            } catch (error) {
              // Log error but continue with other brands
              if (process.env.NODE_ENV === 'development') {
                console.error(`[syncAnalyticsInBackground] Brand ${brand.id} failed:`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      // Log error but don't break the main flow
      console.error('[syncAnalyticsInBackground] Failed:', error);
    }
  })();
}

/**
 * Get demographics data from analytics metadata (no caching - real-time data)
 * Returns empty arrays if no data available
 */
export async function getCachedDemographics(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
  dateFrom: Date,
  dateTo: Date,
) {
  // Get all posts for this user/brand (include all statuses) - don't filter by date yet
  let postsQuery = supabase
    .from('posts')
    .select('id,created_at')
    .eq('user_id', userId)
    .in('status', ['published', 'scheduled', 'draft']);

  if (brandId && brandId !== 'all') {
    postsQuery = postsQuery.eq('brand_id', brandId);
  }

  const { data: allPostsData } = await postsQuery;

  if (!allPostsData || allPostsData.length === 0) {
    return { countries: [], genders: [], ages: [] };
  }

  // Get scheduled_posts data to find published dates (same logic as getCachedPosts)
  const { data: scheduledPostsData } = await supabase
    .from('scheduled_posts')
    .select('post_id,published_at,scheduled_for')
    .in('post_id', allPostsData.map(p => p.id));

  // Create a map of post_id -> published/scheduled date
  const publishedDateMap = new Map<string, Date>();
  for (const scheduled of scheduledPostsData || []) {
    const publishDate = scheduled.published_at || scheduled.scheduled_for;
    if (publishDate) {
      publishedDateMap.set(scheduled.post_id, new Date(publishDate));
    }
  }

  // Filter posts by date range (use published_at/scheduled_for if available, otherwise created_at)
  const postsData = allPostsData.filter((post) => {
    const publishDate = publishedDateMap.get(post.id) || new Date(post.created_at);
    return publishDate >= dateFrom && publishDate <= dateTo;
  });

  if (!postsData || postsData.length === 0) {
    return { countries: [], genders: [], ages: [] };
  }

  // Get analytics with metadata for filtered posts
  // Filter analytics by date range as well
  const { data: analyticsData } = await supabase
    .from('post_analytics')
    .select('metadata,date')
    .in('post_id', postsData.map(p => p.id))
    .not('metadata', 'is', null)
    .gte('date', dateFrom.toISOString().split('T')[0])
    .lte('date', dateTo.toISOString().split('T')[0]);

  if (!analyticsData || analyticsData.length === 0) {
    return { countries: [], genders: [], ages: [] };
  }

  // Aggregate demographics from metadata
  const countriesMap = new Map<string, number>();
  const gendersMap = new Map<string, number>();
  const agesMap = new Map<string, number>();

  for (const analytics of analyticsData) {
    const metadata = analytics.metadata as any;
    if (!metadata || typeof metadata !== 'object') {
      continue;
    }

    // Extract demographics from metadata
    if (metadata.country) {
      countriesMap.set(metadata.country, (countriesMap.get(metadata.country) || 0) + 1);
    }
    if (metadata.gender) {
      gendersMap.set(metadata.gender, (gendersMap.get(metadata.gender) || 0) + 1);
    }
    if (metadata.age_range || metadata.age) {
      const ageKey = metadata.age_range || metadata.age;
      agesMap.set(ageKey, (agesMap.get(ageKey) || 0) + 1);
    }
  }

  // Convert to arrays
  const countries = Array.from(countriesMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const genders = Array.from(gendersMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const ages = Array.from(agesMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return { countries, genders, ages };
}
