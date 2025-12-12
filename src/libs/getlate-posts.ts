import type { SupabaseClient } from '@supabase/supabase-js';
import type { GetlateAnalyticsPost } from './Getlate';
import { createGetlateClient } from './Getlate';

/**
 * Get posts directly from Getlate API for dashboard display
 * Returns posts in the exact format from Getlate API
 */
export async function getGetlatePosts(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
  options?: {
    fromDate?: string;
    toDate?: string;
    platform?: string;
    limit?: number;
    page?: number;
  },
): Promise<GetlateAnalyticsPost[] | null> {
  try {
    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', userId)
      .single();

    if (!userRecord?.getlate_api_key) {
      return null; // No Getlate API key
    }

    // Get brand's Getlate profile ID
    if (!brandId) {
      return null; // Need brand ID to get posts
    }

    const { data: brandRecord } = await supabase
      .from('brands')
      .select('getlate_profile_id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (!brandRecord?.getlate_profile_id) {
      return null; // Brand not linked to Getlate profile
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);

    // Fetch posts from Getlate API analytics endpoint
    // This returns GetlateAnalyticsPost[] which includes all post data and analytics
    const analyticsResponse = await getlateClient.getAnalytics({
      profileId: brandRecord.getlate_profile_id,
      platform: options?.platform as any,
      fromDate: options?.fromDate,
      toDate: options?.toDate,
      limit: options?.limit || 100, // Max 100 per page
      page: options?.page || 1,
      sortBy: 'date',
      order: 'desc',
    });

    // Return posts array from Getlate API response
    return analyticsResponse.posts || [];
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[getGetlatePosts] Error:', error);
    }
    return null;
  }
}
