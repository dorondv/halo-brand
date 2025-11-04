import type { Metadata } from 'next';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import {
  Eye,
  FileText,
  Heart,
  Users,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import DemographicsCharts from '@/components/dashboard/DemographicsCharts';
import EngagementAreaChart from '@/components/dashboard/EngagementAreaChart';
import EngagementRateChart from '@/components/dashboard/EngagementRateChart';
import FollowersTrendChart from '@/components/dashboard/FollowersTrendChart';
import ImpressionsAreaChart from '@/components/dashboard/ImpressionsAreaChart';
import NetFollowerGrowthChart from '@/components/dashboard/NetFollowerGrowthChart';
import PostsByPlatformChart from '@/components/dashboard/PostsByPlatformChart';
import PostsTable from '@/components/dashboard/PostsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { PlatformCards } from './DashboardClient';
import { MetricCardsClient } from './MetricCardsClient';

export const metadata: Metadata = {
  title: 'Halo Brand - Dashboard',
  description: 'Dashboard for social media analytics',
};

type DashboardProps = {
  searchParams: Promise<{
    platform?: string;
    brand?: string;
    metric?: string;
    range?: string;
    granularity?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function Dashboard({ searchParams }: DashboardProps) {
  const params = await searchParams;
  const selectedPlatform = params.platform || null;
  const selectedBrandId = params.brand || null;
  const selectedMetric = params.metric || 'followers';
  const dateRange = params.range || 'last7';
  const granularity = params.granularity || 'day';
  const customFrom = params.from;
  const customTo = params.to;

  const supabase = await createSupabaseServerClient();
  const t = await getTranslations('DashboardPage');
  const locale = await getLocale();
  const isRTL = locale === 'he';

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Get the user from the users table by email (to link auth user with app user)
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single();

  // If user doesn't exist in users table, use auth user ID directly
  const userId = userRecord?.id || session.user.id;

  // Build query for posts with optional brand filter
  let postsQuery = supabase
    .from('posts')
    .select('id,metadata,created_at,content,brand_id')
    .eq('user_id', userId)
    .eq('status', 'published'); // Only count published posts

  if (selectedBrandId && selectedBrandId !== 'all') {
    postsQuery = postsQuery.eq('brand_id', selectedBrandId);
  }

  const { data: postsData } = await postsQuery.order('created_at', { ascending: false });

  // Build query for social accounts with optional brand filter
  let accountsQuery = supabase
    .from('social_accounts')
    .select('id,platform,account_name,platform_specific_data,brand_id')
    .eq('user_id', userId)
    .eq('is_active', true); // Only active accounts

  if (selectedBrandId && selectedBrandId !== 'all') {
    accountsQuery = accountsQuery.eq('brand_id', selectedBrandId);
  }

  const { data: _accountsData } = await accountsQuery;

  // Fetch post analytics (the source of truth for analytics data)
  let analyticsData: any[] = [];
  if (postsData && postsData.length > 0) {
    const { data } = await supabase
      .from('post_analytics')
      .select('post_id,likes,comments,shares,impressions,date,metadata')
      .in('post_id', postsData.map(p => p.id));
    analyticsData = data || [];
  }

  // Create a map of post_id -> analytics entries (grouped by post)
  const analyticsByPost = new Map<string, typeof analyticsData>();
  if (analyticsData && Array.isArray(analyticsData)) {
    for (const analytics of analyticsData) {
      if (!analyticsByPost.has(analytics.post_id)) {
        analyticsByPost.set(analytics.post_id, []);
      }
      analyticsByPost.get(analytics.post_id)!.push(analytics);
    }
  }

  // Helper function to normalize platform names (needed early for follower calculation)
  const normalizePlatform = (platform: string) => {
    const normalized = platform.toLowerCase();
    if (normalized === 'twitter') {
      return 'x';
    }
    return normalized;
  };

  // Calculate date range first (needed for filtering totals)
  const calculateDateRange = () => {
    const today = endOfDay(new Date());

    if (dateRange === 'custom' && customFrom && customTo) {
      return {
        from: startOfDay(new Date(customFrom)),
        to: endOfDay(new Date(customTo)),
      };
    }

    switch (dateRange) {
      case 'last7':
        return { from: startOfDay(subDays(today, 6)), to: today };
      case 'last14':
        return { from: startOfDay(subDays(today, 13)), to: today };
      case 'last28':
        return { from: startOfDay(subDays(today, 27)), to: today };
      case 'lastMonth': {
        const lastMonth = subDays(startOfMonth(today), 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      }
      default:
        return { from: startOfDay(subDays(today, 6)), to: today };
    }
  };

  const { from: rangeFrom, to: rangeTo } = calculateDateRange();

  // Filter by date range first (before calculating totals)
  const filterByDateRange = <T extends { created_at?: string }>(
    items: T[],
  ): T[] => {
    return items.filter((item) => {
      const itemDate = item.created_at ? new Date(item.created_at) : null;
      if (!itemDate) {
        return false;
      }
      return itemDate >= rangeFrom && itemDate <= rangeTo;
    });
  };

  // Filter analytics by date range
  const filterAnalyticsByDateRange = (
    analytics: typeof analyticsData,
  ): typeof analyticsData => {
    if (!analytics || !Array.isArray(analytics)) {
      return [];
    }
    return analytics.filter((a) => {
      if (!a.date) {
        return false;
      }
      const analyticsDate = new Date(a.date);
      return analyticsDate >= rangeFrom && analyticsDate <= rangeTo;
    });
  };

  // Filter posts and analytics by date range first
  const dateFilteredPosts = filterByDateRange(postsData || []);
  const dateFilteredAnalytics = filterAnalyticsByDateRange(analyticsData || []) || [];

  // Aggregate metric sums from date-filtered post_analytics
  let totalImpressions = 0;
  let totalEngagement = 0;
  let totalFollowers = 0;
  let totalPosts = 0;

  if (dateFilteredPosts && Array.isArray(dateFilteredPosts)) {
    totalPosts = dateFilteredPosts.length;

    // Calculate totals from date-filtered analytics
    for (const analytics of dateFilteredAnalytics) {
      totalImpressions += Number(analytics.impressions ?? 0);
      totalEngagement += Number(analytics.likes ?? 0) + Number(analytics.comments ?? 0) + Number(analytics.shares ?? 0);
    }

    // Get followers from platform_specific_data - sum across all accounts/platforms
    // Group by platform and take max per platform (in case multiple accounts on same platform)
    const followersByPlatform = new Map<string, number>();
    for (const acc of _accountsData || []) {
      const platform = (acc as any)?.platform ?? 'unknown';
      const platformData = (acc as any)?.platform_specific_data as any;
      const followers = Number(platformData?.followers ?? 0);
      if (followers > 0) {
        const normalized = normalizePlatform(platform);
        const currentMax = followersByPlatform.get(normalized) ?? 0;
        if (followers > currentMax) {
          followersByPlatform.set(normalized, followers);
        }
      }
    }

    // Sum followers across all platforms
    for (const followers of followersByPlatform.values()) {
      totalFollowers += followers;
    }

    // Fallback: try to get followers from posts metadata if no accounts data
    if (totalFollowers === 0) {
      const followersFromPosts = new Map<string, number>();
      for (const p of dateFilteredPosts) {
        const meta = (p as any)?.metadata as any;
        if (meta && typeof meta === 'object') {
          const platform = meta.platform ?? 'unknown';
          const normalized = normalizePlatform(platform);
          const followers = Number(meta.followers ?? 0);
          if (followers > 0) {
            const currentMax = followersFromPosts.get(normalized) ?? 0;
            if (followers > currentMax) {
              followersFromPosts.set(normalized, followers);
            }
          }
        }
      }
      // Sum followers from posts metadata
      for (const followers of followersFromPosts.values()) {
        totalFollowers += followers;
      }
    }
  }

  // Build per-platform metrics from post_analytics and posts
  const platformMap = new Map<string, { followers: number; impressions: number; posts: number }>();
  if (_accountsData && Array.isArray(_accountsData)) {
    for (const acc of _accountsData) {
      const plat = (acc as any)?.platform ?? 'unknown';
      if (!platformMap.has(plat)) {
        const platformData = (acc as any)?.platform_specific_data as any;
        platformMap.set(plat, {
          followers: Number(platformData?.followers ?? 0),
          impressions: 0,
          posts: 0,
        });
      }
    }
  }

  // Create a map of post_id -> post for quick lookup (using date-filtered posts)
  const postsMapForPlatform = new Map(dateFilteredPosts?.map(p => [p.id, p]) || []);

  // Aggregate analytics by platform (via posts) - using date-filtered analytics
  if (dateFilteredAnalytics && Array.isArray(dateFilteredAnalytics)) {
    for (const analytics of dateFilteredAnalytics) {
      const post = postsMapForPlatform.get(analytics.post_id);
      if (!post) {
        continue;
      }

      // Get platform from post metadata or try to find via brand/social account
      const meta = (post as any)?.metadata as any;
      const plat = meta?.platform ?? 'unknown';

      const entry = platformMap.get(plat) ?? { followers: 0, impressions: 0, posts: 0 };
      entry.impressions += Number(analytics.impressions ?? 0);
      // Posts count will be calculated separately
      platformMap.set(plat, entry);
    }
  }

  // Count posts per platform (from date-filtered posts)
  if (dateFilteredPosts && Array.isArray(dateFilteredPosts)) {
    for (const post of dateFilteredPosts) {
      const meta = (post as any)?.metadata as any;
      const plat = meta?.platform ?? 'unknown';
      const entry = platformMap.get(plat) ?? { followers: 0, impressions: 0, posts: 0 };
      entry.posts += 1;
      platformMap.set(plat, entry);
    }
  }

  // Helper function to generate granularity key from date
  const getGranularityKey = (date: Date): string => {
    switch (granularity) {
      case 'day':
        return format(date, 'yyyy-MM-dd');
      case 'week':
        return format(startOfDay(date), 'yyyy-MM-dd');
      case 'month':
        return format(startOfMonth(date), 'yyyy-MM');
      case 'year':
        return format(date, 'yyyy');
      default:
        return format(date, 'yyyy-MM-dd');
    }
  };

  // Deterministic pseudo-random generator based on a string seed.
  // This replaces calls to Math.random() in the render path so ESLint
  // doesn't flag impure functions during render and mock values remain
  // stable across renders for the same inputs.
  const seededRandom = (seed: string) => {
    // FNV-1a 32-bit hash
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // Convert to float in [0, 1)
    return (h >>> 0) / 4294967296;
  };

  // Helper function to build series map from analytics data
  const buildSeriesMap = (analytics: typeof analyticsData, posts: any[]): Record<string, { followers: number; impressions: number; count: number; engagement: number }> => {
    const map: Record<string, { followers: number; impressions: number; count: number; engagement: number }> = {};
    const postsMap = new Map(posts.map(p => [p.id, p]));

    if (!analytics || !Array.isArray(analytics)) {
      return map;
    }

    for (const a of analytics) {
      const analyticsDate = a.date ? new Date(a.date) : null;
      if (!analyticsDate) {
        continue;
      }

      const key = getGranularityKey(analyticsDate);

      if (!map[key]) {
        map[key] = { followers: 0, impressions: 0, count: 0, engagement: 0 };
      }

      map[key].impressions += Number(a.impressions ?? 0);
      map[key].engagement += Number(a.likes ?? 0) + Number(a.comments ?? 0) + Number(a.shares ?? 0);
      map[key].count += 1;

      // Get followers from post's metadata or account (one-time lookup per post)
      const post = postsMap.get(a.post_id);
      if (post) {
        const meta = (post as any)?.metadata as any;
        const followers = Number(meta?.followers ?? 0);
        if (followers > map[key].followers) {
          map[key].followers = followers;
        }
      }
    }
    return map;
  };

  // Build series map from date-filtered analytics (using date-filtered posts)
  const seriesMap = buildSeriesMap(dateFilteredAnalytics, dateFilteredPosts || []);

  const formatted = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

  // Filter data based on selected platform
  const filterByPlatform = <T extends { platform?: string; metadata?: any }>(
    items: T[],
    platform: string | null,
  ): T[] => {
    if (!platform || platform === 'all') {
      return items;
    }
    const normalized = normalizePlatform(platform);
    return items.filter((item) => {
      const itemPlatform = item.platform
        ? normalizePlatform(item.platform)
        : item.metadata?.platform
          ? normalizePlatform(item.metadata.platform)
          : null;
      return itemPlatform === normalized;
    });
  };

  // Use date-filtered data (already calculated above)
  const dateFilteredAnalyticsForMetrics = dateFilteredAnalytics;

  // Filter analytics by platform (via posts)
  const finalFilteredPosts = selectedPlatform && selectedPlatform !== 'all'
    ? filterByPlatform(dateFilteredPosts, selectedPlatform)
    : dateFilteredPosts;

  const finalFilteredPostIds = new Set(finalFilteredPosts.map(p => p.id));
  const finalFilteredAnalytics = dateFilteredAnalyticsForMetrics.filter(a =>
    finalFilteredPostIds.has(a.post_id),
  );

  // Recalculate metrics based on filtered analytics data (platform + date filtered)
  let filteredImpressions = 0;
  let filteredEngagement = 0;
  let filteredFollowers = 0;
  let filteredPostsCount = 0;

  filteredPostsCount = finalFilteredPosts.length;

  // Calculate from filtered analytics
  for (const a of finalFilteredAnalytics) {
    filteredImpressions += Number(a.impressions ?? 0);
    filteredEngagement += Number(a.likes ?? 0) + Number(a.comments ?? 0) + Number(a.shares ?? 0);
  }

  // Get followers from accounts for selected platform
  // If platform is selected, get followers from accounts of that platform
  if (selectedPlatform && selectedPlatform !== 'all') {
    const normalizedPlatform = normalizePlatform(selectedPlatform);
    for (const acc of _accountsData || []) {
      const accPlatform = normalizePlatform((acc as any)?.platform ?? 'unknown');
      if (accPlatform === normalizedPlatform) {
        const platformData = (acc as any)?.platform_specific_data as any;
        const followers = Number(platformData?.followers ?? 0);
        // Take max if multiple accounts on same platform
        filteredFollowers = Math.max(filteredFollowers, followers);
      }
    }

    // Fallback: try to get from posts metadata
    if (filteredFollowers === 0) {
      for (const post of finalFilteredPosts) {
        const meta = (post as any)?.metadata as any;
        if (meta && typeof meta === 'object') {
          const postPlatform = normalizePlatform(meta.platform ?? 'unknown');
          if (postPlatform === normalizedPlatform) {
            filteredFollowers = Math.max(filteredFollowers, Number(meta.followers ?? 0));
          }
        }
      }
    }
  } else {
    // If "all" is selected, filteredFollowers should equal totalFollowers
    filteredFollowers = totalFollowers;
  }

  // If platform is selected, use filtered metrics, otherwise use totals
  const displayImpressions = selectedPlatform && selectedPlatform !== 'all' ? filteredImpressions : totalImpressions;
  const displayEngagement = selectedPlatform && selectedPlatform !== 'all' ? filteredEngagement : totalEngagement;
  const displayFollowers = selectedPlatform && selectedPlatform !== 'all' ? filteredFollowers : totalFollowers;
  const displayPosts = selectedPlatform && selectedPlatform !== 'all' ? filteredPostsCount : totalPosts;

  // Generate date series based on granularity
  const generateDateSeries = () => {
    const dates: string[] = [];
    let current = new Date(rangeFrom);
    const end = new Date(rangeTo);

    while (current <= end) {
      let key: string;

      switch (granularity) {
        case 'day':
          key = format(current, 'yyyy-MM-dd');
          // move forward by one day (reassign to satisfy loop modification lint rule)
          current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'week':
          key = format(startOfDay(current), 'yyyy-MM-dd');
          // move forward by one week
          current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month': {
          key = format(startOfMonth(current), 'yyyy-MM');
          const nextMonth = new Date(current);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          current = new Date(nextMonth.getTime());
          break;
        }
        case 'year':
          key = format(startOfDay(current), 'yyyy');
          current = new Date(current.getFullYear() + 1, current.getMonth(), current.getDate());
          break;
        default:
          key = format(current, 'yyyy-MM-dd');
          current.setDate(current.getDate() + 1);
      }

      if (!dates.includes(key)) {
        dates.push(key);
      }
    }

    return dates.length > 0 ? dates : [format(rangeFrom, 'yyyy-MM-dd')];
  };

  const dateSeries = generateDateSeries();

  // Build filtered series map using finalFilteredAnalytics (already filtered by date and platform)
  const filteredSeriesMap = buildSeriesMap(finalFilteredAnalytics, finalFilteredPosts);

  // Use filtered or total series based on platform selection
  const activeSeriesMap = selectedPlatform && selectedPlatform !== 'all' ? filteredSeriesMap : seriesMap;

  // Generate engagement series data based on date series and granularity
  const engagementSeries = dateSeries.map((dateKey) => {
    const seriesData = activeSeriesMap[dateKey] || filteredSeriesMap[dateKey];
    // Use actual data or distribute total evenly across dates if no data
    const baseEngagement = seriesData?.engagement ?? (displayEngagement > 0 ? Math.floor(displayEngagement / dateSeries.length) : 0);

    return {
      date: dateKey,
      engagement: baseEngagement,
    };
  });

  // Generate impressions series data based on date series and granularity
  const impressionsSeriesData = dateSeries.map((dateKey) => {
    const seriesData = activeSeriesMap[dateKey] || filteredSeriesMap[dateKey];
    // Use actual data or distribute total evenly across dates if no data
    const baseImpressions = seriesData?.impressions ?? (displayImpressions > 0 ? Math.floor(displayImpressions / dateSeries.length) : 0);

    return {
      date: dateKey,
      impressions: baseImpressions,
    };
  });

  // Generate follower trend series based on date series
  const followerTrendSeries = dateSeries.map((dateKey) => {
    const seriesData = activeSeriesMap[dateKey] || filteredSeriesMap[dateKey];
    // Use max followers from series data, or fallback to displayFollowers
    const followers = seriesData && seriesData.followers > 0 ? seriesData.followers : displayFollowers;
    return {
      date: dateKey,
      followers: followers || 0,
    };
  });

  // Calculate platform metrics from actual analytics and posts data (must be before postsByPlatformData)
  const platformFollowersMap = new Map<string, { followers: number; change: number }>();
  const platformPostsCount = new Map<string, number>();
  const platformImpressionsMap = new Map<string, number>();
  const platformEngagementMap = new Map<string, number>();

  // Calculate followers and posts per platform from date-filtered posts
  if (dateFilteredPosts && Array.isArray(dateFilteredPosts)) {
    for (const p of dateFilteredPosts) {
      const meta = (p as any)?.metadata as any;
      const plat = meta?.platform ? normalizePlatform(meta.platform) : 'unknown';

      // Get followers from account's platform_specific_data if available
      let followers = Number(meta?.followers ?? 0);
      if (followers === 0) {
        const account = _accountsData?.find(acc => normalizePlatform(acc.platform) === plat);
        if (account) {
          const platformData = (account as any)?.platform_specific_data as any;
          followers = Number(platformData?.followers ?? 0);
        }
      }

      // Track max followers per platform (most recent value)
      const current = platformFollowersMap.get(plat);
      if (!current || followers > current.followers) {
        platformFollowersMap.set(plat, {
          followers,
          change: current?.change ?? 0,
        });
      }

      // Count posts per platform
      platformPostsCount.set(plat, (platformPostsCount.get(plat) || 0) + 1);

      // Sum impressions and engagement per platform from analytics
      const analytics = finalFilteredAnalytics.filter((a) => {
        const post = dateFilteredPosts.find((p: any) => p.id === a.post_id);
        if (!post) {
          return false;
        }
        const postMeta = (post as any)?.metadata as any;
        return normalizePlatform(postMeta?.platform ?? 'unknown') === plat;
      });

      const platformImpressions = analytics.reduce((sum, a) => sum + Number(a.impressions ?? 0), 0);
      const platformEngagement = analytics.reduce((sum, a) => {
        return sum + Number(a.likes ?? 0) + Number(a.comments ?? 0) + Number(a.shares ?? 0);
      }, 0);

      if (platformImpressions > 0) {
        platformImpressionsMap.set(plat, (platformImpressionsMap.get(plat) || 0) + platformImpressions);
      }
      if (platformEngagement > 0) {
        platformEngagementMap.set(plat, (platformEngagementMap.get(plat) || 0) + platformEngagement);
      }
    }
  }

  // Update followers from accounts if available (even if no posts)
  if (_accountsData && Array.isArray(_accountsData)) {
    for (const acc of _accountsData) {
      const plat = normalizePlatform((acc as any)?.platform ?? 'unknown');
      const platformData = (acc as any)?.platform_specific_data as any;
      const followers = Number(platformData?.followers ?? 0);

      if (followers > 0) {
        const current = platformFollowersMap.get(plat);
        if (!current || followers > current.followers) {
          platformFollowersMap.set(plat, {
            followers,
            change: current?.change ?? 0,
          });
        }
      }

      if (!platformPostsCount.has(plat)) {
        platformPostsCount.set(plat, 0);
      }
    }
  }

  // Calculate growth/change percentages (simple mock - would need historical data for real calculation)
  // Only set change for platforms that have followers (connected)
  for (const [plat, data] of platformFollowersMap.entries()) {
    if (data.followers > 0 && data.change === 0) {
      // Mock change percentage (deterministic per platform)
      platformFollowersMap.set(plat, { ...data, change: seededRandom(`change:${plat}`) * 6 });
    }
  }

  // Generate net follower growth based on date series
  // Note: Real calculation would need historical data. Using mock growth for now.
  const netGrowthSeries = dateSeries.map((dateKey) => {
    // Mock growth calculation (would need previous period data for real calculation)
    const seriesData = activeSeriesMap[dateKey] || filteredSeriesMap[dateKey];
    const mockGrowth = seriesData ? Math.floor(seededRandom(`growth:${dateKey}`) * 40) - 10 : 0;
    return {
      date: dateKey,
      growth: mockGrowth,
    };
  });

  // Calculate posts by platform from actual data
  const postsByPlatformData = Array.from(platformPostsCount.entries()).map(([platform, count]) => {
    // Capitalize platform name for display
    const displayName = platform.charAt(0).toUpperCase() + platform.slice(1);
    return { platform: displayName, posts: count };
  });

  // If no data, use fallback for display
  if (postsByPlatformData.length === 0) {
    const fallbackPlatforms = ['YouTube', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'Instagram'];
    postsByPlatformData.push(...fallbackPlatforms.map(p => ({ platform: p, posts: 0 })));
  }

  // Filter if platform is selected
  const filteredPostsByPlatform = selectedPlatform && selectedPlatform !== 'all'
    ? postsByPlatformData.filter(p => normalizePlatform(p.platform) === normalizePlatform(selectedPlatform))
    : postsByPlatformData;

  // Generate engagement rate series based on date series
  const engagementRateSeries = dateSeries.map((dateKey) => {
    const seriesData = activeSeriesMap[dateKey] || filteredSeriesMap[dateKey];
    const rate = seriesData && seriesData.impressions > 0
      ? (seriesData.engagement / seriesData.impressions) * 100
      : 0; // No fallback - use 0 if no data
    return {
      date: dateKey,
      rate: Math.round(rate * 10) / 10,
    };
  });

  // Metric cards show filtered values when platform is selected, totals when "all" is selected
  const finalTotalPosts = displayPosts;
  const finalTotalEngagement = displayEngagement;
  const finalTotalImpressions = displayImpressions;
  const finalTotalFollowers = displayFollowers;

  // Calculate platform-specific metrics from database data
  const getPlatformMetric = (platformName: string, metric: string) => {
    if (platformName === 'all') {
      // Always return total for "all" platform card
      switch (metric) {
        case 'followers':
          return totalFollowers;
        case 'impressions':
          return totalImpressions;
        case 'engagement':
          return totalEngagement;
        case 'posts':
          return totalPosts;
        default:
          return totalFollowers;
      }
    }

    const platformKey = normalizePlatform(platformName);
    switch (metric) {
      case 'followers':
        return platformFollowersMap.get(platformKey)?.followers || 0;
      case 'impressions':
        return platformImpressionsMap.get(platformKey) || 0;
      case 'engagement':
        return platformEngagementMap.get(platformKey) || 0;
      case 'posts':
        return platformPostsCount.get(platformKey) || 0;
      default:
        return platformFollowersMap.get(platformKey)?.followers || 0;
    }
  };

  const getPlatformChange = (platformName: string, metric: string) => {
    if (platformName === 'all') {
      return 0;
    }
    const platformKey = normalizePlatform(platformName);
    if (metric === 'followers') {
      return platformFollowersMap.get(platformKey)?.change || 0;
    }
    // Mock change for other metrics
    return seededRandom(`change:${platformKey}:${metric}`) * 6;
  };

  // Platform metrics calculated from database data
  // Only include platforms that have connections (followers > 0 or posts > 0)
  // Order: YouTube, Facebook, LinkedIn, TikTok, X, Instagram, all (LTR)
  // For RTL, we need to reverse to: all, Instagram, X, TikTok, LinkedIn, Facebook, YouTube
  const allPlatformsConfig = [
    { platform: 'YouTube', key: 'youtube' },
    { platform: 'Facebook', key: 'facebook' },
    { platform: 'LinkedIn', key: 'linkedin' },
    { platform: 'TikTok', key: 'tiktok' },
    { platform: 'X', key: 'x' },
    { platform: 'Instagram', key: 'instagram' },
  ];

  // Filter to only show platforms with connections (followers > 0 or posts > 0)
  const connectedPlatforms = allPlatformsConfig.filter(({ key }) => {
    const followers = platformFollowersMap.get(key)?.followers || 0;
    const posts = platformPostsCount.get(key) || 0;
    return followers > 0 || posts > 0;
  });

  // Pre-calculate ALL metrics for ALL platforms for instant client-side switching
  type MetricType = 'followers' | 'impressions' | 'engagement' | 'posts';
  const allMetrics: MetricType[] = ['followers', 'impressions', 'engagement', 'posts'];

  const platformDataWithAllMetrics = connectedPlatforms.map(({ platform }) => {
    const metrics: Record<MetricType, { value: number; change: number }> = {} as any;
    allMetrics.forEach((metric) => {
      metrics[metric] = {
        value: getPlatformMetric(platform, metric),
        change: getPlatformChange(platform, metric),
      };
    });
    return {
      platform,
      metrics,
    };
  });

  // Also pre-calculate "all" platform metrics
  const allPlatformMetrics: Record<MetricType, { value: number; change: number }> = {} as any;
  allMetrics.forEach((metric) => {
    allPlatformMetrics[metric] = {
      value: getPlatformMetric('all', metric),
      change: 0,
    };
  });

  // Build current platform data based on selected metric (for backward compatibility)
  const platformCards = connectedPlatforms.map(({ platform }) => ({
    platform,
    value: getPlatformMetric(platform, selectedMetric),
    change: getPlatformChange(platform, selectedMetric),
    metric: selectedMetric,
  }));

  // Build base array: "All" first for both, but platforms reversed for RTL
  const platformDataBase = isRTL
    ? [{ platform: 'all', value: getPlatformMetric('all', selectedMetric), change: 0, metric: selectedMetric }, ...[...platformCards].reverse()]
    : [{ platform: 'all', value: getPlatformMetric('all', selectedMetric), change: 0, metric: selectedMetric }, ...platformCards];

  // Use the base order directly (already correct for the locale)
  const platformData = platformDataBase;

  // Demographics data (TODO: fetch from database when analytics table is populated)
  const countriesData = [
    { name: 'ישראל', value: 75 },
    { name: 'ארה"ב', value: 15 },
    { name: 'אירופה', value: 5 },
    { name: 'אחר', value: 5 },
  ];

  const gendersData = [
    { name: 'נשים', value: 58 },
    { name: 'גברים', value: 42 },
  ];

  const agesData = [
    { name: '+45', value: 27 },
    { name: '35-44', value: 36 },
    { name: '25-34', value: 19 },
    { name: '18-24', value: 11 },
    { name: '13-17', value: 7 },
  ];

  // Generate filtered posts table data from actual posts if available, otherwise use dummy data
  let postsTableData: Array<{
    score: number;
    engagementRate: number;
    engagement: number;
    impressions: number;
    date: string;
    postContent: string;
    platform: string;
  }> | undefined;

  if (finalFilteredPosts && finalFilteredPosts.length > 0) {
    // Create a map of post_id -> latest analytics for quick lookup
    type AnalyticsEntry = { post_id: string; likes: number | null; comments: number | null; shares: number | null; impressions: number | null; date: string; metadata: any };
    const latestAnalyticsByPost = new Map<string, AnalyticsEntry>();
    for (const analytics of finalFilteredAnalytics) {
      const existing = latestAnalyticsByPost.get(analytics.post_id);
      if (!existing || (analytics.date && existing.date && new Date(analytics.date) > new Date(existing.date))) {
        latestAnalyticsByPost.set(analytics.post_id, analytics);
      }
    }

    postsTableData = finalFilteredPosts.slice(0, 10).map((p) => {
      // Get analytics for this post (latest entry)
      const analytics = latestAnalyticsByPost.get(p.id);
      const impressions = analytics ? Number(analytics.impressions ?? 0) : 0;
      const engagement = analytics
        ? Number(analytics.likes ?? 0) + Number(analytics.comments ?? 0) + Number(analytics.shares ?? 0)
        : 0;
      const engagementRate = impressions > 0 ? (engagement / impressions) * 100 : 0;
      const score = Math.floor(engagementRate * 100 + engagement / 10); // Simple score calculation

      const meta = (p as any)?.metadata as any;

      return {
        score,
        engagementRate,
        engagement,
        impressions,
        date: analytics?.date ?? (p as any)?.created_at ?? new Date().toISOString(),
        postContent: (p as any)?.content ?? 'פוסט ללא תוכן',
        platform: meta?.platform ?? 'unknown',
      };
    });
  }
  if (selectedPlatform && selectedPlatform !== 'all') {
    // Use deterministic dummy data when platform is selected but no DB data
    const baseTs = new Date(rangeTo).getTime();
    postsTableData = [0, 1].map((i) => {
      const seed = `${selectedPlatform}:${i}`;
      const score = Math.floor(seededRandom(`${seed}:score`) * 500) + (i === 0 ? 700 : 500);
      const engagementRate = Math.round((seededRandom(`${seed}:rate`) * 5 + (i === 0 ? 6 : 5)) * 10) / 10;
      const engagement = Math.floor(seededRandom(`${seed}:eng`) * (i === 0 ? 500 : 400)) + (i === 0 ? 400 : 300);
      const impressions = Math.floor(seededRandom(`${seed}:imp`) * (i === 0 ? 5000 : 4000)) + (i === 0 ? 5000 : 4000);
      const dateOffset = Math.floor(seededRandom(`${seed}:date`) * 7 * 24 * 60 * 60 * 1000);
      return {
        score,
        engagementRate,
        engagement,
        impressions,
        date: new Date(baseTs - dateOffset).toISOString(),
        postContent: `דוגמה לפוסט מהפלטפורמה ${selectedPlatform}${i === 1 ? ' (אחר)' : ''}`,
        platform: selectedPlatform,
      };
    });
  }
  // If no platform selected, postsTableData remains undefined and component uses default data

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full space-y-8 p-6">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <DateRangePicker />
          </div>
        </div>

        {/* Row 1: KPI Cards */}
        <MetricCardsClient
          followers={formatted(finalTotalFollowers)}
          impressions={formatted(finalTotalImpressions)}
          engagement={formatted(finalTotalEngagement)}
          posts={formatted(finalTotalPosts)}
          vsLabel={t('vs_last_month')}
        />

        {/* Row 2: Platform Cards */}
        <PlatformCards
          platformData={platformData}
          platformDataWithAllMetrics={platformDataWithAllMetrics}
          allPlatformMetrics={allPlatformMetrics}
          selectedPlatform={selectedPlatform}
          selectedMetric={selectedMetric}
          isRTL={isRTL}
        />

        {/* Row 3: Engagement, Impressions, Follower Trend Charts */}
        {/* Order for LTR: Engagement, Impressions, Followers Trend */}
        {/* Order for RTL: Followers Trend, Impressions, Engagement (reversed) */}
        {(() => {
          const chartCards1 = [
            <Card key="engagement" className="rounded-lg border border-gray-200 bg-white shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                  <Heart className="h-5 w-5 text-[#FF0083]" />
                  {t('chart_engagement')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EngagementAreaChart data={engagementSeries} />
              </CardContent>
            </Card>,
            <Card key="impressions" className="rounded-lg border border-gray-200 bg-white shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                  <Eye className="h-5 w-5 text-[#FF0083]" />
                  {t('chart_impressions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ImpressionsAreaChart data={impressionsSeriesData} />
              </CardContent>
            </Card>,
            <Card key="followers" className="rounded-lg border border-gray-200 bg-white shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                  <Users className="h-5 w-5 text-[#FF0083]" />
                  {t('chart_followers_trend')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FollowersTrendChart data={followerTrendSeries} />
              </CardContent>
            </Card>,
          ];
          return (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {isRTL ? [...chartCards1].reverse() : chartCards1}
            </div>
          );
        })()}

        {/* Row 4: Net Follower Growth, Posts by Platform, Engagement Rate */}
        {/* Order for LTR: Net Follower Growth, Posts by Platform, Engagement Rate */}
        {/* Order for RTL: Engagement Rate, Posts by Platform, Net Follower Growth (reversed) */}
        {(() => {
          const chartCards2 = [
            <Card key="net-growth" className="rounded-lg border border-gray-200 bg-white shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                  <Users className="h-5 w-5 text-[#FF0083]" />
                  {t('chart_net_follower_growth')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NetFollowerGrowthChart data={netGrowthSeries} />
              </CardContent>
            </Card>,
            <Card key="posts-platform" className="rounded-lg border border-gray-200 bg-white shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                  <FileText className="h-5 w-5 text-[#FF0083]" />
                  {t('chart_posts_by_platform')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PostsByPlatformChart data={filteredPostsByPlatform} />
              </CardContent>
            </Card>,
            <Card key="engagement-rate" className="rounded-lg border border-gray-200 bg-white shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                  <Heart className="h-5 w-5 text-[#FF0083]" />
                  {t('chart_engagement_rate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EngagementRateChart data={engagementRateSeries} />
              </CardContent>
            </Card>,
          ];
          return (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {isRTL ? [...chartCards2].reverse() : chartCards2}
            </div>
          );
        })()}

        {/* Row 5: Demographics Charts */}
        {/* Order for LTR: Countries, Gender, Age */}
        {/* Order for RTL: Age, Gender, Countries (reversed) */}
        <DemographicsCharts
          countries={countriesData}
          genders={gendersData}
          ages={agesData}
          countriesTitle={t('chart_countries_mix')}
          genderTitle={t('chart_gender_mix')}
          ageTitle={t('chart_age_mix')}
          isRTL={isRTL}
        />

        {/* Row 6: Posts Table */}
        <PostsTable posts={postsTableData} />
      </div>
    </div>
  );
}
