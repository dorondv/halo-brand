import type { SupabaseClient } from '@supabase/supabase-js';
import { createGetlateClient } from './Getlate';

/**
 * Fetch follower stats from Getlate API
 * This function fetches follower statistics and returns them for use in charts
 */
export async function getFollowerStatsFromGetlate(
  supabase: SupabaseClient,
  userId: string,
  brandId: string | null,
  options?: {
    fromDate?: Date;
    toDate?: Date;
    granularity?: 'daily' | 'weekly' | 'monthly';
  },
): Promise<{
  followerTrend: Array<{ date: string; followers: number }>;
  netGrowth: Array<{ date: string; growth: number }>;
  accounts?: Array<{
    _id: string;
    platform: string;
    username: string;
    currentFollowers: number;
    growth: number;
    growthPercentage: number;
    dataPoints: number;
  }>;
} | null> {
  try {
    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', userId)
      .single();

    if (!userRecord?.getlate_api_key) {
      return null; // No Getlate API key, skip
    }

    // Get brand's Getlate profile ID
    let profileId: string | undefined;
    if (brandId && brandId !== 'all') {
      const { data: brandRecord } = await supabase
        .from('brands')
        .select('getlate_profile_id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (!brandRecord?.getlate_profile_id) {
        return null; // Brand not linked to Getlate profile, skip
      }
      profileId = brandRecord.getlate_profile_id;
    } else {
      // For "all brands", get the first brand with a Getlate profile
      const { data: brands } = await supabase
        .from('brands')
        .select('getlate_profile_id')
        .eq('user_id', userId)
        .not('getlate_profile_id', 'is', null)
        .limit(1);

      if (!brands || brands.length === 0 || !brands[0]?.getlate_profile_id) {
        return null; // No brands with Getlate profiles
      }
      profileId = brands[0].getlate_profile_id;
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);

    // Calculate date range
    const toDate = options?.toDate || new Date();
    const fromDate = options?.fromDate || (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30); // Default to last 30 days
      return date;
    })();

    // Fetch follower stats from Getlate API
    const followerStats = await getlateClient.getFollowerStats({
      profileId,
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
      granularity: options?.granularity || 'daily',
    });

    if (!followerStats || !followerStats.stats) {
      return null;
    }

    // Aggregate follower stats across all accounts
    // The stats object has account IDs as keys, each with an array of { date, followers }
    const followerMap = new Map<string, number>(); // date -> total followers

    // Process all account stats
    for (const accountStats of Object.values(followerStats.stats)) {
      if (!Array.isArray(accountStats)) {
        continue;
      }

      for (const stat of accountStats) {
        const date = stat.date;
        const followers = stat.followers || 0;

        // Sum followers across all accounts for each date
        const currentTotal = followerMap.get(date) || 0;
        followerMap.set(date, currentTotal + followers);
      }
    }

    // Convert to arrays sorted by date
    const followerTrend = Array.from(followerMap.entries())
      .map(([date, followers]) => ({ date, followers }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate net growth (change from previous day)
    // Use absolute value to show positive growth values
    const netGrowth: Array<{ date: string; growth: number }> = [];
    for (let i = 0; i < followerTrend.length; i++) {
      const current = followerTrend[i];
      if (!current) {
        continue; // Skip if current is undefined
      }
      const previous = i > 0 ? followerTrend[i - 1] : null;
      const growth = previous ? current.followers - previous.followers : 0;
      netGrowth.push({
        date: current.date,
        growth: Math.abs(growth), // Always show positive values
      });
    }

    return {
      followerTrend,
      netGrowth,
      accounts: followerStats.accounts || [],
    };
  } catch (error) {
    // Log error but don't break the dashboard
    if (process.env.NODE_ENV === 'development') {
      console.error('[getFollowerStatsFromGetlate] Error:', error);
    }
    return null;
  }
}
