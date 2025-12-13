import type { SupabaseClient } from '@supabase/supabase-js';
import type { GetlateAnalyticsPost, GetlatePlatform } from './Getlate';
import { createGetlateClient } from './Getlate';

/**
 * Get posts directly from Getlate API for dashboard display
 * Fetches all pages to match the overview count exactly
 * Returns posts in the exact format from Getlate API
 */
export async function getGetlatePosts(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
  options?: {
    fromDate?: string;
    toDate?: string;
    platform?: GetlatePlatform | 'all';
    limit?: number;
    page?: number;
  },
): Promise<GetlateAnalyticsPost[]> {
  try {
    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', userId)
      .single();

    if (!userRecord?.getlate_api_key) {
      return []; // No Getlate API key
    }

    // Get brand's Getlate profile ID
    if (!brandId) {
      return []; // Need brand ID to get posts
    }

    const { data: brandRecord } = await supabase
      .from('brands')
      .select('getlate_profile_id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (!brandRecord?.getlate_profile_id) {
      return []; // Brand not linked to Getlate profile
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);

    // Fetch all pages to match the overview count exactly
    // This ensures the table shows the same posts that are counted in totalPosts
    let allGetlatePosts: GetlateAnalyticsPost[] = [];
    let currentPage = 1;
    const pageSize = options?.limit || 100; // Max 100 per page (Getlate API limit)
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const analyticsResponse = await getlateClient.getAnalytics({
          profileId: brandRecord.getlate_profile_id,
          platform: options?.platform,
          fromDate: options?.fromDate,
          toDate: options?.toDate,
          limit: pageSize,
          page: currentPage,
          sortBy: 'date',
          order: 'desc',
        });

        const pagePosts = analyticsResponse.posts || [];
        allGetlatePosts = [...allGetlatePosts, ...pagePosts];

        // Check if we've reached the last page
        if (analyticsResponse.pagination) {
          if (currentPage >= analyticsResponse.pagination.pages || pagePosts.length === 0) {
            hasMorePages = false;
          } else {
            currentPage++;
          }
        } else {
          // Fallback: if no pagination info, check if we got fewer results than pageSize
          if (pagePosts.length < pageSize) {
            hasMorePages = false;
          } else {
            currentPage++;
          }
        }

        // Safety limit: don't fetch more than 20 pages (2000 records max)
        // This prevents infinite loops and respects rate limits
        if (currentPage > 20) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[getGetlatePosts] Reached pagination limit (20 pages)');
          }
          hasMorePages = false;
        }
      } catch (error: any) {
        // Handle rate limit errors (HTTP 429)
        if (error?.status === 429) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[getGetlatePosts] Rate limit reached, stopping pagination');
          }
          hasMorePages = false;
        } else {
          // For other errors, log and stop pagination
          if (process.env.NODE_ENV === 'development') {
            console.error('[getGetlatePosts] Error fetching page:', error);
          }
          hasMorePages = false;
        }
      }
    }

    return allGetlatePosts;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[getGetlatePosts] Error:', error);
    }
    return [];
  }
}
