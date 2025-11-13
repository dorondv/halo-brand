import type { SupabaseClient } from '@supabase/supabase-js';
import { createGetlateClient } from './Getlate';

/**
 * Sync analytics from Getlate API to database
 * This function can be called from both API routes and server components
 */
export async function syncAnalyticsFromGetlate(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  options?: {
    postId?: string; // Local post ID (UUID) - will be used to find Getlate post ID
    getlatePostId?: string; // Getlate post ID - use this if you have it directly
    platform?: string;
    fromDate?: string;
    toDate?: string;
  },
): Promise<void> {
  try {
    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', userId)
      .single();

    if (!userRecord?.getlate_api_key) {
      return; // No Getlate API key, skip sync
    }

    // Get brand's Getlate profile ID
    const { data: brandRecord } = await supabase
      .from('brands')
      .select('getlate_profile_id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (!brandRecord?.getlate_profile_id) {
      return; // Brand not linked to Getlate profile, skip sync
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);

    // Determine Getlate post ID if local post ID was provided
    let getlatePostIdForQuery: string | undefined = options?.getlatePostId;
    if (!getlatePostIdForQuery && options?.postId) {
      // Find the Getlate post ID from the local post
      const { data: postRecord } = await supabase
        .from('posts')
        .select('getlate_post_id')
        .eq('id', options.postId)
        .single();

      getlatePostIdForQuery = postRecord?.getlate_post_id || undefined;
    }

    // Fetch analytics from Getlate with pagination support
    // Getlate API supports pagination: limit (default: 50), page (default: 1)
    // Rate limit: 30 requests per hour per user
    // We'll fetch all pages to get comprehensive data
    let allGetlateAnalytics: any[] = [];
    let currentPage = 1;
    const pageSize = 50; // Max allowed by Getlate API
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const analyticsResponse = await getlateClient.getAnalytics({
          profileId: brandRecord.getlate_profile_id,
          postId: getlatePostIdForQuery, // Use Getlate post ID for query
          platform: options?.platform as any,
          fromDate: options?.fromDate,
          toDate: options?.toDate,
          limit: pageSize,
          page: currentPage,
          sortBy: 'date', // Sort by date for consistent ordering
          order: 'desc', // Most recent first
        });

        // Extract posts from the structured response
        const pageAnalytics = analyticsResponse.posts || [];

        // If we got fewer results than pageSize, we've reached the last page
        if (pageAnalytics.length < pageSize) {
          hasMorePages = false;
        }

        // Also check pagination info if available
        if (analyticsResponse.pagination) {
          if (currentPage >= analyticsResponse.pagination.pages) {
            hasMorePages = false;
          }
        }

        allGetlateAnalytics = [...allGetlateAnalytics, ...pageAnalytics];

        // If no analytics returned, stop pagination
        if (pageAnalytics.length === 0) {
          hasMorePages = false;
        }

        currentPage++;

        // Safety limit: don't fetch more than 20 pages (1000 records max)
        // This prevents infinite loops and respects rate limits
        if (currentPage > 20) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[syncAnalyticsFromGetlate] Reached pagination limit (20 pages)');
          }
          hasMorePages = false;
        }
      } catch (error: any) {
        // Handle rate limit errors (HTTP 429)
        if (error?.message?.includes('429') || error?.message?.includes('rate limit')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[syncAnalyticsFromGetlate] Rate limit reached, stopping pagination');
          }
          hasMorePages = false;
        } else {
          // For other errors, log and stop
          if (process.env.NODE_ENV === 'development') {
            console.error('[syncAnalyticsFromGetlate] Error fetching page', currentPage, ':', error);
          }
          hasMorePages = false;
        }
      }
    }

    const getlateAnalytics = allGetlateAnalytics;

    // Sync analytics to database
    for (const post of getlateAnalytics) {
      // GetlateAnalyticsPost uses _id field
      const getlatePostId = post._id || post.id;
      if (!getlatePostId) {
        continue;
      }

      // Find post by Getlate post ID
      const { data: postRecord } = await supabase
        .from('posts')
        .select('id')
        .eq('getlate_post_id', getlatePostId)
        .maybeSingle();

      // If not found by exact match, try to find by partial match
      let foundPost = postRecord || null;
      if (!foundPost) {
        const { data: allPosts } = await supabase
          .from('posts')
          .select('id, getlate_post_id')
          .eq('brand_id', brandId)
          .not('getlate_post_id', 'is', null);

        const matchedPost = allPosts?.find(p =>
          p.getlate_post_id === getlatePostId
          || String(p.getlate_post_id) === String(getlatePostId),
        );
        foundPost = matchedPost ? { id: matchedPost.id } : null;
      }

      if (foundPost) {
        // Extract analytics from post structure
        // Use platform-specific analytics if available, otherwise use post-level analytics
        const platformAnalytics = post.platforms?.[0]?.analytics || post.analytics || {};

        // Get platform from post
        const platform = post.platform || post.platforms?.[0]?.platform || 'unknown';
        // Get date from publishedAt or scheduledFor
        const date = post.publishedAt || post.scheduledFor || new Date().toISOString().split('T')[0];

        // Extract engagement metrics from platform analytics
        const likes = platformAnalytics.likes ?? null;
        const comments = platformAnalytics.comments ?? null;
        const shares = platformAnalytics.shares ?? null;
        const impressions = platformAnalytics.impressions ?? null;
        const reach = platformAnalytics.reach ?? null;
        const clicks = platformAnalytics.clicks ?? null;
        const views = platformAnalytics.views ?? null;
        const engagementRate = platformAnalytics.engagementRate ?? null;

        // Calculate engagement rate if not provided
        const calculatedEngagementRate = engagementRate !== null
          ? engagementRate
          : (impressions && (likes || comments || shares))
              ? ((likes || 0) + (comments || 0) + (shares || 0)) / impressions * 100
              : null;

        // Check if analytics record already exists
        const { data: existingAnalytics } = await supabase
          .from('post_analytics')
          .select('id')
          .eq('getlate_post_id', getlatePostId)
          .eq('platform', platform)
          .eq('date', date)
          .maybeSingle();

        const analyticsData = {
          post_id: foundPost.id,
          getlate_post_id: getlatePostId,
          platform,
          likes,
          comments,
          shares,
          impressions,
          engagement_rate: calculatedEngagementRate !== null ? calculatedEngagementRate.toString() : null,
          date,
          metadata: {
            reach,
            clicks,
            views,
            lastUpdated: platformAnalytics.lastUpdated,
            ...(post.metadata || {}),
          },
        };

        if (existingAnalytics) {
          // Update existing record
          await supabase
            .from('post_analytics')
            .update(analyticsData)
            .eq('id', existingAnalytics.id);
        } else {
          // Create new record
          await supabase
            .from('post_analytics')
            .insert(analyticsData);
        }
      }
    }
  } catch (error) {
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('[syncAnalyticsFromGetlate] Error:', error);
    }
    throw error; // Re-throw so caller knows sync failed
  }
}
