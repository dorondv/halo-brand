import type { SupabaseClient } from '@supabase/supabase-js';
import { createGetlateClient } from './Getlate';

/**
 * Get analytics overview from Getlate API
 * Returns totalPosts, publishedPosts, scheduledPosts, and lastSync
 * This matches exactly what Getlate API returns in the overview object
 */
export async function getGetlateAnalyticsOverview(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
  options?: {
    fromDate?: string;
    toDate?: string;
    platform?: string;
  },
): Promise<{
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  lastSync: string;
} | null> {
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
      return null; // Need brand ID to get overview
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

    // Fetch analytics overview from Getlate API
    // Use limit=1 to minimize data transfer (we only need the overview)
    const analyticsResponse = await getlateClient.getAnalytics({
      profileId: brandRecord.getlate_profile_id,
      platform: options?.platform as any,
      fromDate: options?.fromDate,
      toDate: options?.toDate,
      limit: 1, // Minimal limit since we only need overview
      page: 1,
    });

    // Return overview data from Getlate API response
    if (analyticsResponse.overview) {
      return {
        totalPosts: analyticsResponse.overview.totalPosts || 0,
        publishedPosts: analyticsResponse.overview.publishedPosts || 0,
        scheduledPosts: analyticsResponse.overview.scheduledPosts || 0,
        lastSync: analyticsResponse.overview.lastSync || new Date().toISOString(),
      };
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[getGetlateAnalyticsOverview] Error:', error);
    }
    return null;
  }
}
