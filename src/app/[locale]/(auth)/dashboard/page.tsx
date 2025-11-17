import type { Metadata } from 'next';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import {
  Eye,
  FileText,
  Heart,
  Users,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
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
import {
  getCachedAccounts,
  getCachedDemographics,
  getCachedPosts,
  syncAnalyticsInBackground,
} from '@/libs/dashboard-cache';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { PlatformCards } from './DashboardClient';
import { DashboardWrapper } from './DashboardWrapper';
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

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: DashboardProps) {
  const params = await searchParams;
  const selectedPlatform = params.platform || null;

  // In Next.js 16, cookies() can only be called once per request
  // We need to share the cookie store between brand reading and Supabase client
  // Read brand from URL first, fallback to cookie (for initial load before URL sync)
  // Note: "all brands" is represented as null (no brand parameter in URL, no cookie)
  let selectedBrandId: string | null = null;

  // Get cookie store once (must be shared with createSupabaseServerClient)
  const cookieStore = await cookies();

  // Read brand from URL - URL is the source of truth
  // If brand param exists, use it (never "all" since we remove it from URL)
  // If brand param is missing, it means "all brands" was selected (or initial load)
  // For initial load, fall back to cookie; otherwise use null (all brands)
  if (params.brand && params.brand !== 'all') {
    // Brand param exists in URL - use it
    selectedBrandId = params.brand;
  } else {
    // No brand param in URL - means "all brands" was selected
    // On brand-aware pages like dashboard, missing brand param = "all brands"
    // This works because BrandSelector removes the param when "all" is selected
    selectedBrandId = null;
  }

  const selectedMetric = params.metric || 'followers';
  const dateRange = params.range || 'last7';
  const granularity = params.granularity || 'day';
  const customFrom = params.from;
  const customTo = params.to;

  // Create Supabase client with shared cookie store (Next.js 16 best practice)
  const supabase = await createSupabaseServerClient(cookieStore);
  const t = await getTranslations('DashboardPage');
  const locale = await getLocale();
  const isRTL = locale === 'he';

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  // Get the user from the users table by email (to link auth user with app user)
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single();

  // If user doesn't exist in users table, use auth user ID directly
  const userId = userRecord?.id || user.id;

  // Calculate date range first (needed for cached queries)
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

  // Calculate previous period for comparison (same duration, shifted back)
  const calculatePreviousPeriod = () => {
    const duration = rangeTo.getTime() - rangeFrom.getTime();
    const previousTo = new Date(rangeFrom.getTime() - 1); // Day before current period starts
    const previousFrom = new Date(previousTo.getTime() - duration);
    return { from: previousFrom, to: previousTo };
  };

  const { from: previousRangeFrom, to: previousRangeTo } = calculatePreviousPeriod();

  // Create Supabase client outside cache scope (required for Next.js 16)
  // Note: supabase is already created above (line 61)

  // Use cached functions for data fetching (non-blocking, cached)
  // Pass supabase client as parameter since it uses cookies() which can't be in cache scope
  // Fetch both current and previous period data in parallel
  const [
    { posts: postsData, analytics: analyticsData },
    { posts: previousPostsData, analytics: previousAnalyticsData },
    _accountsData,
    demographics,
  ] = await Promise.all([
    getCachedPosts(supabase, userId, selectedBrandId, rangeFrom, rangeTo),
    getCachedPosts(supabase, userId, selectedBrandId, previousRangeFrom, previousRangeTo),
    getCachedAccounts(supabase, userId, selectedBrandId),
    getCachedDemographics(supabase, userId, selectedBrandId, rangeFrom, rangeTo),
  ]);

  // Trigger background analytics sync (non-blocking)
  // Pass date range to sync only relevant data
  syncAnalyticsInBackground(supabase, userId, selectedBrandId, {
    dateFrom: rangeFrom,
    dateTo: rangeTo,
  });

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

  // Posts are already filtered by date range from cache
  const dateFilteredPosts = postsData || [];

  // Filter analytics by date range
  // Include analytics that are within the date range (regardless of post publish date)
  const dateFilteredAnalytics = (analyticsData || []).filter((a) => {
    if (!a.date) {
      return false;
    }
    const analyticsDate = new Date(a.date);
    return analyticsDate >= rangeFrom && analyticsDate <= rangeTo;
  });

  // Aggregate metric sums from date-filtered post_analytics
  let totalImpressions = 0;
  let totalEngagement = 0;
  let totalFollowers = 0;
  let totalPosts = 0;

  if (dateFilteredPosts && Array.isArray(dateFilteredPosts)) {
    totalPosts = dateFilteredPosts.length;

    // Calculate totals from date-filtered analytics
    // Engagement = likes + comments + shares (all engagement types)
    for (const analytics of dateFilteredAnalytics) {
      totalImpressions += Number(analytics.impressions ?? 0);
      // Ensure we're using the correct field names and handling null/undefined
      const likes = Number(analytics.likes ?? 0);
      const comments = Number(analytics.comments ?? 0);
      const shares = Number(analytics.shares ?? 0);
      totalEngagement += likes + comments + shares;
    }

    // Get followers from platform_specific_data - sum across all accounts/platforms
    // Group by platform and take max per platform (in case multiple accounts on same platform)
    const followersByPlatform = new Map<string, number>();
    for (const acc of _accountsData || []) {
      const platform = (acc as any)?.platform ?? 'unknown';
      const platformData = (acc as any)?.platform_specific_data as any;
      // Try follower_count first (from Getlate), then followers
      const followers = Number(platformData?.follower_count ?? platformData?.followers ?? 0);
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
  }

  // Build per-platform metrics from analytics and accounts
  // Priority: analytics.platform (most reliable) > post.metadata.platform > account.platform
  const platformMap = new Map<string, { followers: number; impressions: number; posts: number; engagement: number }>();

  // Initialize platform map from accounts (for followers)
  // Take maximum followers if multiple accounts on same platform
  if (_accountsData && Array.isArray(_accountsData)) {
    for (const acc of _accountsData) {
      const plat = normalizePlatform((acc as any)?.platform ?? 'unknown');
      const platformData = (acc as any)?.platform_specific_data as any;
      const followers = Number(platformData?.follower_count ?? platformData?.followers ?? 0);

      if (!platformMap.has(plat)) {
        platformMap.set(plat, {
          followers,
          impressions: 0,
          posts: 0,
          engagement: 0,
        });
      } else {
        // Update followers if this account has more followers
        const current = platformMap.get(plat)!;
        if (followers > current.followers) {
          current.followers = followers;
          platformMap.set(plat, current);
        }
      }
    }
  }

  // Create a map of post_id -> platforms from analytics (most reliable source)
  const postPlatformMap = new Map<string, Set<string>>();
  if (dateFilteredAnalytics && Array.isArray(dateFilteredAnalytics)) {
    for (const analytics of dateFilteredAnalytics) {
      // Use analytics.platform as primary source (most reliable)
      if (analytics.platform) {
        const plat = normalizePlatform(analytics.platform);
        if (!postPlatformMap.has(analytics.post_id)) {
          postPlatformMap.set(analytics.post_id, new Set());
        }
        postPlatformMap.get(analytics.post_id)!.add(plat);

        // Aggregate metrics by platform from analytics
        // Preserve existing followers if already set from accounts
        const existingEntry = platformMap.get(plat);
        const entry = existingEntry ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
        // Preserve followers (don't overwrite with 0 if already set)
        entry.followers = existingEntry?.followers ?? 0;
        entry.impressions += Number(analytics.impressions ?? 0);
        // Calculate engagement: likes + comments + shares
        const likes = Number(analytics.likes ?? 0);
        const comments = Number(analytics.comments ?? 0);
        const shares = Number(analytics.shares ?? 0);
        entry.engagement += likes + comments + shares;
        platformMap.set(plat, entry);
      }
    }
  }

  // Get scheduled_posts with social_accounts to find platform for posts without analytics
  const postIdsForPlatformLookup = dateFilteredPosts?.map(p => p.id) || [];
  let scheduledPostsWithAccounts: any[] = [];
  if (postIdsForPlatformLookup.length > 0) {
    const { data } = await supabase
      .from('scheduled_posts')
      .select('post_id,social_accounts!inner(platform)')
      .in('post_id', postIdsForPlatformLookup);
    scheduledPostsWithAccounts = data || [];
  }

  // Create a map of post_id -> platforms from scheduled_posts -> social_accounts
  const postPlatformMapFromScheduled = new Map<string, Set<string>>();
  for (const scheduled of scheduledPostsWithAccounts) {
    const account = (scheduled as any)?.social_accounts;
    if (account?.platform) {
      const plat = normalizePlatform(account.platform);
      if (!postPlatformMapFromScheduled.has(scheduled.post_id)) {
        postPlatformMapFromScheduled.set(scheduled.post_id, new Set());
      }
      postPlatformMapFromScheduled.get(scheduled.post_id)!.add(plat);
    }
  }

  // Count posts per platform (use analytics platform if available, otherwise fallback to multiple sources)
  // Use a Set to track which posts we've already counted per platform to avoid double-counting
  const postsCountedPerPlatform = new Map<string, Set<string>>();

  if (dateFilteredPosts && Array.isArray(dateFilteredPosts)) {
    for (const post of dateFilteredPosts) {
      // Priority order for platform detection:
      // 1. Analytics platform (most reliable)
      // 2. Scheduled posts -> social accounts -> platform
      // 3. Post platforms array (from Getlate)
      // 4. Post metadata.platform
      let platforms: string[] = [];

      const platformsFromAnalytics = postPlatformMap.get(post.id);
      if (platformsFromAnalytics && platformsFromAnalytics.size > 0) {
        // Use all platforms from analytics (a post can be on multiple platforms)
        platforms = Array.from(platformsFromAnalytics);
      } else {
        // Try scheduled posts -> social accounts
        const platformsFromScheduled = postPlatformMapFromScheduled.get(post.id);
        if (platformsFromScheduled && platformsFromScheduled.size > 0) {
          platforms = Array.from(platformsFromScheduled);
        } else {
          // Try post platforms array (from Getlate)
          const postPlatforms = (post as any)?.platforms;
          if (postPlatforms && Array.isArray(postPlatforms) && postPlatforms.length > 0) {
            platforms = postPlatforms.map((p: any) => {
              if (typeof p === 'string') {
                return normalizePlatform(p);
              }
              if (p?.platform) {
                return normalizePlatform(p.platform);
              }
              return null;
            }).filter(Boolean) as string[];
          }

          // Fallback to post metadata
          if (platforms.length === 0) {
            const meta = (post as any)?.metadata as any;
            const metaPlatform = normalizePlatform(meta?.platform ?? 'unknown');
            platforms = [metaPlatform];
          }
        }
      }

      // If still no platform found, try to get from accounts (if post has brand_id)
      if (platforms.length === 0 || (platforms.length === 1 && platforms[0] === 'unknown')) {
        // Try to find platform from accounts for this brand
        const postBrandId = (post as any)?.brand_id;
        if (postBrandId && _accountsData) {
          const brandAccounts = _accountsData.filter((acc: any) => acc.brand_id === postBrandId);
          if (brandAccounts.length > 0) {
            // Use the first account's platform
            const firstAccountPlatform = normalizePlatform(brandAccounts[0]?.platform ?? 'unknown');
            if (firstAccountPlatform !== 'unknown') {
              platforms = [firstAccountPlatform];
            }
          }
        }
      }

      // Count post for each platform it belongs to (but only once per platform)
      for (const plat of platforms) {
        // Skip 'unknown' platform - we want to assign posts to real platforms
        if (plat === 'unknown') {
          continue;
        }

        // Initialize Set for this platform if needed
        if (!postsCountedPerPlatform.has(plat)) {
          postsCountedPerPlatform.set(plat, new Set());
        }

        // Only count if we haven't counted this post for this platform yet
        if (!postsCountedPerPlatform.get(plat)!.has(post.id)) {
          const existingEntry = platformMap.get(plat);
          const entry = existingEntry ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
          // Preserve followers and other metrics if already set
          if (existingEntry) {
            entry.followers = existingEntry.followers;
            entry.impressions = existingEntry.impressions;
            entry.engagement = existingEntry.engagement;
          }
          entry.posts += 1;
          platformMap.set(plat, entry);
          postsCountedPerPlatform.get(plat)!.add(post.id);
        }
      }
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

  // Helper function to build series map from analytics data
  // Note: Followers should be set separately from platformMap, not from post metadata
  const buildSeriesMap = (analytics: typeof analyticsData): Record<string, { followers: number; impressions: number; count: number; engagement: number }> => {
    const map: Record<string, { followers: number; impressions: number; count: number; engagement: number }> = {};

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
      // Calculate engagement: likes + comments + shares
      const likes = Number(a.likes ?? 0);
      const comments = Number(a.comments ?? 0);
      const shares = Number(a.shares ?? 0);
      map[key].engagement += likes + comments + shares;
      map[key].count += 1;

      // Note: Followers will be set from platformMap after building the series map
      // This ensures we use the correct followers from accounts, not post metadata
    }
    return map;
  };

  // Build series map from date-filtered analytics
  const seriesMap = buildSeriesMap(dateFilteredAnalytics);

  const formatted = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

  // Use date-filtered data (already calculated above)
  const dateFilteredAnalyticsForMetrics = dateFilteredAnalytics;

  // Filter posts by platform first (include posts even if they don't have analytics yet)
  const finalFilteredPosts = selectedPlatform && selectedPlatform !== 'all'
    ? dateFilteredPosts.filter((p) => {
        const normalizedSelectedPlatform = normalizePlatform(selectedPlatform);

        // Check if post has analytics with matching platform
        const platformsFromAnalytics = postPlatformMap.get(p.id);
        if (platformsFromAnalytics && platformsFromAnalytics.has(normalizedSelectedPlatform)) {
          return true;
        }

        // Check scheduled posts -> social accounts -> platform
        const platformsFromScheduled = postPlatformMapFromScheduled.get(p.id);
        if (platformsFromScheduled && platformsFromScheduled.has(normalizedSelectedPlatform)) {
          return true;
        }

        // Check post platforms array (from Getlate)
        const postPlatforms = (p as any)?.platforms;
        if (postPlatforms && Array.isArray(postPlatforms) && postPlatforms.length > 0) {
          const platforms = postPlatforms.map((pl: any) => {
            if (typeof pl === 'string') {
              return normalizePlatform(pl);
            }
            if (pl?.platform) {
              return normalizePlatform(pl.platform);
            }
            return null;
          }).filter(Boolean) as string[];
          if (platforms.includes(normalizedSelectedPlatform)) {
            return true;
          }
        }

        // Check post metadata
        const meta = (p as any)?.metadata as any;
        const metaPlatform = normalizePlatform(meta?.platform ?? 'unknown');
        if (metaPlatform === normalizedSelectedPlatform) {
          return true;
        }

        return false;
      })
    : dateFilteredPosts;

  // Filter analytics by platform AND ensure they belong to filtered posts
  const finalFilteredPostIds = new Set(finalFilteredPosts.map(p => p.id));
  const finalFilteredAnalytics = selectedPlatform && selectedPlatform !== 'all'
    ? dateFilteredAnalyticsForMetrics.filter((a) => {
        // Must belong to a filtered post
        if (!finalFilteredPostIds.has(a.post_id)) {
          return false;
        }

        // Check platform match
        if (a.platform) {
          return normalizePlatform(a.platform) === normalizePlatform(selectedPlatform);
        }
        // Fallback: check if post has matching platform
        const platforms = postPlatformMap.get(a.post_id);
        return platforms && platforms.has(normalizePlatform(selectedPlatform));
      })
    : dateFilteredAnalyticsForMetrics;

  // Recalculate metrics based on filtered analytics data (platform + date filtered)
  let filteredImpressions = 0;
  let filteredEngagement = 0;
  let filteredFollowers = 0;
  let filteredPostsCount = 0;

  filteredPostsCount = finalFilteredPosts.length;

  // Calculate from filtered analytics (only analytics for the selected platform)
  for (const a of finalFilteredAnalytics) {
    filteredImpressions += Number(a.impressions ?? 0);
    // Calculate engagement: likes + comments + shares
    const likes = Number(a.likes ?? 0);
    const comments = Number(a.comments ?? 0);
    const shares = Number(a.shares ?? 0);
    filteredEngagement += likes + comments + shares;
  }

  // Get followers from accounts for selected platform
  // If platform is selected, get followers from accounts of that platform
  if (selectedPlatform && selectedPlatform !== 'all') {
    const normalizedPlatform = normalizePlatform(selectedPlatform);

    // First priority: Get from platformMap (already calculated with max followers per platform)
    const platformData = platformMap.get(normalizedPlatform);
    if (platformData && platformData.followers > 0) {
      filteredFollowers = platformData.followers;
    } else {
      // Fallback: Calculate directly from accounts
      for (const acc of _accountsData || []) {
        const accPlatform = normalizePlatform((acc as any)?.platform ?? 'unknown');
        if (accPlatform === normalizedPlatform) {
          const platformData = (acc as any)?.platform_specific_data as any;
          // Try follower_count first (from Getlate), then followers
          const followers = Number(platformData?.follower_count ?? platformData?.followers ?? 0);
          // Take max if multiple accounts on same platform
          filteredFollowers = Math.max(filteredFollowers, followers);
        }
      }

      // Last fallback: try to get from posts metadata
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
  const filteredSeriesMap = buildSeriesMap(finalFilteredAnalytics);

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
  // Use displayFollowers (from platformMap/accounts) for all dates since followers are a snapshot
  // When platform is selected, displayFollowers already contains the correct platform-specific followers
  const followerTrendSeries = dateSeries.map((dateKey) => {
    // Use displayFollowers which is already correctly calculated from platformMap/accounts
    // This ensures we use real-time follower data from accounts, not post metadata
    return {
      date: dateKey,
      followers: displayFollowers || 0,
    };
  });

  // Calculate platform metrics from platformMap (already aggregated from analytics)
  const platformFollowersMap = new Map<string, { followers: number; change: number }>();
  const platformPostsCount = new Map<string, number>();
  const platformImpressionsMap = new Map<string, number>();
  const platformEngagementMap = new Map<string, number>();

  // Extract metrics from platformMap (this is the source of truth for platform data)
  for (const [plat, data] of platformMap.entries()) {
    platformFollowersMap.set(plat, {
      followers: data.followers,
      change: 0, // Real change calculation requires historical data
    });
    // Use posts count from platformMap (already counted correctly above)
    platformPostsCount.set(plat, data.posts);
    platformImpressionsMap.set(plat, data.impressions);
    platformEngagementMap.set(plat, data.engagement);
  }

  // Debug logging in development - verify platform posts count matches platformMap

  // Also ensure accounts are included even if no posts/analytics
  if (_accountsData && Array.isArray(_accountsData)) {
    for (const acc of _accountsData) {
      const plat = normalizePlatform((acc as any)?.platform ?? 'unknown');
      if (!platformFollowersMap.has(plat)) {
        const platformData = (acc as any)?.platform_specific_data as any;
        const followers = Number(platformData?.follower_count ?? platformData?.followers ?? 0);
        platformFollowersMap.set(plat, {
          followers,
          change: 0,
        });
        platformPostsCount.set(plat, platformPostsCount.get(plat) || 0);
        platformImpressionsMap.set(plat, platformImpressionsMap.get(plat) || 0);
        platformEngagementMap.set(plat, platformEngagementMap.get(plat) || 0);
      }
    }
  }

  // Update followers from accounts if available (even if no posts)
  if (_accountsData && Array.isArray(_accountsData)) {
    for (const acc of _accountsData) {
      const plat = normalizePlatform((acc as any)?.platform ?? 'unknown');
      const platformData = (acc as any)?.platform_specific_data as any;
      const followers = Number(platformData?.follower_count ?? platformData?.followers ?? 0);

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

  // Calculate growth/change percentages
  // For now, set to 0 (real calculation requires historical data)
  // TODO: Implement real change calculation when historical follower data is available
  for (const [plat, data] of platformFollowersMap.entries()) {
    if (data.followers > 0 && data.change === 0) {
      // Real change calculation requires historical data comparison
      platformFollowersMap.set(plat, { ...data, change: 0 });
    }
  }

  // Generate net follower growth based on date series
  // Calculate from actual follower changes (if we have historical data)
  // Otherwise show 0 (no growth data available)
  const netGrowthSeries = dateSeries.map((dateKey) => {
    // For now, show 0 if no historical comparison data available
    // TODO: Implement real growth calculation when historical follower data is available
    // Real growth calculation requires comparing current followers with previous period
    return {
      date: dateKey,
      growth: 0, // Real growth calculation requires historical data
    };
  });

  // Calculate posts by platform from actual data
  const postsByPlatformData = Array.from(platformPostsCount.entries())
    .filter(([_, count]) => count > 0) // Only show platforms with posts
    .map(([platform, count]) => {
      // Capitalize platform name for display
      const displayName = platform.charAt(0).toUpperCase() + platform.slice(1);
      return { platform: displayName, posts: count };
    });

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

  // Calculate previous period metrics for comparison
  // Filter previous analytics by date range
  const previousDateFilteredAnalytics = (previousAnalyticsData || []).filter((a) => {
    if (!a.date) {
      return false;
    }
    const analyticsDate = new Date(a.date);
    return analyticsDate >= previousRangeFrom && analyticsDate <= previousRangeTo;
  });

  // Calculate previous period totals
  let previousTotalImpressions = 0;
  let previousTotalEngagement = 0;
  let previousTotalPosts = 0;

  // Filter previous posts by date range (same logic as current period)
  const { data: previousScheduledPostsData } = await supabase
    .from('scheduled_posts')
    .select('post_id,published_at,scheduled_for,status')
    .in('post_id', (previousPostsData || []).map((p: any) => p.id));

  const previousPublishedDateMap = new Map<string, Date>();
  for (const scheduled of previousScheduledPostsData || []) {
    const publishDate = scheduled.published_at || scheduled.scheduled_for;
    if (publishDate) {
      previousPublishedDateMap.set(scheduled.post_id, new Date(publishDate));
    }
  }

  const previousDateFilteredPosts = (previousPostsData || []).filter((post: any) => {
    const publishDate = previousPublishedDateMap.get(post.id) || new Date(post.created_at);
    return publishDate >= previousRangeFrom && publishDate <= previousRangeTo;
  });

  previousTotalPosts = previousDateFilteredPosts.length;

  // Calculate previous period analytics totals
  for (const analytics of previousDateFilteredAnalytics) {
    previousTotalImpressions += Number(analytics.impressions ?? 0);
    const likes = Number(analytics.likes ?? 0);
    const comments = Number(analytics.comments ?? 0);
    const shares = Number(analytics.shares ?? 0);
    previousTotalEngagement += likes + comments + shares;
  }

  // Get previous period followers (use same accounts data, but this is a limitation)
  // For accurate follower comparison, we'd need historical follower snapshots
  // For now, we'll use the same follower count (no change) or calculate from analytics if available
  const previousTotalFollowers = totalFollowers; // Default: assume no change (limitation)

  // Calculate previous period metrics per platform
  const previousPlatformMap = new Map<string, { followers: number; impressions: number; posts: number; engagement: number }>();

  // Initialize previous platform map from accounts (same as current)
  if (_accountsData && Array.isArray(_accountsData)) {
    for (const acc of _accountsData) {
      const plat = normalizePlatform((acc as any)?.platform ?? 'unknown');
      if (!previousPlatformMap.has(plat)) {
        const platformData = (acc as any)?.platform_specific_data as any;
        previousPlatformMap.set(plat, {
          followers: Number(platformData?.follower_count ?? platformData?.followers ?? 0),
          impressions: 0,
          posts: 0,
          engagement: 0,
        });
      }
    }
  }

  // Aggregate previous period analytics by platform
  for (const analytics of previousDateFilteredAnalytics) {
    if (analytics.platform) {
      const plat = normalizePlatform(analytics.platform);
      const entry = previousPlatformMap.get(plat) ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
      entry.impressions += Number(analytics.impressions ?? 0);
      const likes = Number(analytics.likes ?? 0);
      const comments = Number(analytics.comments ?? 0);
      const shares = Number(analytics.shares ?? 0);
      entry.engagement += likes + comments + shares;
      previousPlatformMap.set(plat, entry);
    }
  }

  // Count previous period posts per platform
  const previousPostPlatformMap = new Map<string, Set<string>>();
  for (const analytics of previousDateFilteredAnalytics) {
    if (analytics.platform) {
      const plat = normalizePlatform(analytics.platform);
      if (!previousPostPlatformMap.has(analytics.post_id)) {
        previousPostPlatformMap.set(analytics.post_id, new Set());
      }
      previousPostPlatformMap.get(analytics.post_id)!.add(plat);
    }
  }

  const previousPostsCountedPerPlatform = new Map<string, Set<string>>();
  for (const post of previousDateFilteredPosts) {
    const platformsFromAnalytics = previousPostPlatformMap.get((post as any).id);
    if (platformsFromAnalytics && platformsFromAnalytics.size > 0) {
      for (const plat of platformsFromAnalytics) {
        if (plat === 'unknown') {
          continue;
        }
        if (!previousPostsCountedPerPlatform.has(plat)) {
          previousPostsCountedPerPlatform.set(plat, new Set());
        }
        if (!previousPostsCountedPerPlatform.get(plat)!.has((post as any).id)) {
          const entry = previousPlatformMap.get(plat) ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
          entry.posts += 1;
          previousPlatformMap.set(plat, entry);
          previousPostsCountedPerPlatform.get(plat)!.add((post as any).id);
        }
      }
    }
  }

  // Calculate percentage changes
  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) {
      // If previous is 0, return 100% increase if current > 0, else 0
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  };

  const followersChange = calculatePercentageChange(totalFollowers, previousTotalFollowers);
  const impressionsChange = calculatePercentageChange(totalImpressions, previousTotalImpressions);
  const engagementChange = calculatePercentageChange(totalEngagement, previousTotalEngagement);
  const postsChange = calculatePercentageChange(totalPosts, previousTotalPosts);

  // If platform is selected, calculate changes for filtered metrics
  const finalFollowersChange = selectedPlatform && selectedPlatform !== 'all'
    ? calculatePercentageChange(filteredFollowers, previousTotalFollowers) // Simplified: compare with total previous
    : followersChange;
  const finalImpressionsChange = selectedPlatform && selectedPlatform !== 'all'
    ? calculatePercentageChange(filteredImpressions, previousTotalImpressions)
    : impressionsChange;
  const finalEngagementChange = selectedPlatform && selectedPlatform !== 'all'
    ? calculatePercentageChange(filteredEngagement, previousTotalEngagement)
    : engagementChange;
  const finalPostsChange = selectedPlatform && selectedPlatform !== 'all'
    ? calculatePercentageChange(filteredPostsCount, previousTotalPosts)
    : postsChange;

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
      // Use the calculated changes for "all" platform
      switch (metric) {
        case 'followers':
          return followersChange;
        case 'impressions':
          return impressionsChange;
        case 'engagement':
          return engagementChange;
        case 'posts':
          return postsChange;
        default:
          return followersChange;
      }
    }

    const platformKey = normalizePlatform(platformName);
    const currentValue = getPlatformMetric(platformName, metric);

    // Get previous period value for this platform and metric
    let previousValue = 0;
    const previousPlatformData = previousPlatformMap.get(platformKey);

    switch (metric) {
      case 'followers':
        previousValue = previousPlatformData?.followers ?? 0;
        // If no previous data, use current (no change)
        if (previousValue === 0) {
          previousValue = currentValue;
        }
        break;
      case 'impressions':
        previousValue = previousPlatformData?.impressions ?? 0;
        break;
      case 'engagement':
        previousValue = previousPlatformData?.engagement ?? 0;
        break;
      case 'posts':
        previousValue = previousPlatformData?.posts ?? 0;
        break;
    }

    return calculatePercentageChange(currentValue, previousValue);
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

  // Filter to only show platforms with connections
  // Show platform if it exists in any of the maps (even if values are 0)
  // This ensures platforms are visible if they have any data or accounts
  const connectedPlatforms = allPlatformsConfig.filter(({ key }) => {
    // Check if platform exists in any map
    const hasFollowers = platformFollowersMap.has(key);
    const hasPosts = platformPostsCount.has(key);
    const hasImpressions = platformImpressionsMap.has(key);
    const hasEngagement = platformEngagementMap.has(key);
    const hasInPlatformMap = platformMap.has(key);

    // Show if platform exists in any map OR has any data > 0
    if (hasFollowers || hasPosts || hasImpressions || hasEngagement || hasInPlatformMap) {
      const followers = platformFollowersMap.get(key)?.followers || 0;
      const posts = platformPostsCount.get(key) || 0;
      const impressions = platformImpressionsMap.get(key) || 0;
      const engagement = platformEngagementMap.get(key) || 0;
      // Show if exists in map OR has data > 0
      return followers > 0 || posts > 0 || impressions > 0 || engagement > 0 || hasInPlatformMap;
    }
    return false;
  });

  // Also include platforms that exist in platformMap but not in allPlatformsConfig
  // This handles cases where platforms are detected but not in the predefined list
  const detectedPlatforms = Array.from(platformMap.keys()).filter((key) => {
    // Skip 'unknown' platform
    if (key === 'unknown') {
      return false;
    }
    // Check if already in connectedPlatforms
    const alreadyIncluded = connectedPlatforms.some(p => p.key === key);
    if (alreadyIncluded) {
      return false;
    }
    // Include if it has any data
    const data = platformMap.get(key);
    return data && (data.followers > 0 || data.posts > 0 || data.impressions > 0 || data.engagement > 0);
  });

  // Add detected platforms that aren't in the config
  const additionalPlatforms = detectedPlatforms.map(key => ({
    platform: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize first letter
    key,
  }));

  const allConnectedPlatforms = [...connectedPlatforms, ...additionalPlatforms];

  // Pre-calculate ALL metrics for ALL platforms for instant client-side switching
  type MetricType = 'followers' | 'impressions' | 'engagement' | 'posts';
  const allMetrics: MetricType[] = ['followers', 'impressions', 'engagement', 'posts'];

  const platformDataWithAllMetrics = allConnectedPlatforms.map(({ platform }) => {
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
      change: getPlatformChange('all', metric),
    };
  });

  // Build current platform data based on selected metric (for backward compatibility)
  const platformCards = allConnectedPlatforms.map(({ platform }) => ({
    platform,
    value: getPlatformMetric(platform, selectedMetric),
    change: getPlatformChange(platform, selectedMetric),
    metric: selectedMetric,
  }));

  // Build base array: "All" first for both, but platforms reversed for RTL
  const platformDataBase = isRTL
    ? [{ platform: 'all', value: getPlatformMetric('all', selectedMetric), change: getPlatformChange('all', selectedMetric), metric: selectedMetric }, ...[...platformCards].reverse()]
    : [{ platform: 'all', value: getPlatformMetric('all', selectedMetric), change: getPlatformChange('all', selectedMetric), metric: selectedMetric }, ...platformCards];

  // Use the base order directly (already correct for the locale)
  const platformData = platformDataBase;

  // Demographics data from cached function (real data only, empty arrays if no data)
  const { countries: countriesData, genders: gendersData, ages: agesData } = demographics;

  // Generate filtered posts table data from actual posts if available, otherwise use dummy data
  let postsTableData: Array<{
    id?: string;
    score: number;
    engagementRate: number;
    engagement: number;
    impressions: number;
    date: string;
    postContent: string;
    platform: string;
    mediaUrls?: string[];
    imageUrl?: string;
  }> | undefined;

  // Generate filtered posts table data from actual posts only (no dummy data)
  if (finalFilteredPosts && finalFilteredPosts.length > 0) {
    // Create a map of post_id -> latest analytics for quick lookup
    type AnalyticsEntry = { post_id: string; likes: number | null; comments: number | null; shares: number | null; impressions: number | null; date: string; metadata: any; platform?: string | null };
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

      // Get platform using the same priority order as the rest of the dashboard:
      // 1. Analytics platform (most reliable)
      // 2. Scheduled posts -> social accounts -> platform
      // 3. Post platforms array (from Getlate)
      // 4. Post metadata.platform
      let platform = 'unknown';

      // Priority 1: Analytics platform
      const platformsFromAnalytics = postPlatformMap.get(p.id);
      if (platformsFromAnalytics && platformsFromAnalytics.size > 0) {
        const platformsArray = Array.from(platformsFromAnalytics);
        platform = platformsArray[0] || 'unknown';
      } else {
        // Priority 2: Scheduled posts -> social accounts
        const platformsFromScheduled = postPlatformMapFromScheduled.get(p.id);
        if (platformsFromScheduled && platformsFromScheduled.size > 0) {
          const platformsArray = Array.from(platformsFromScheduled);
          platform = platformsArray[0] || 'unknown';
        } else {
          // Priority 3: Post platforms array (from Getlate)
          const postPlatforms = (p as any)?.platforms;
          if (postPlatforms && Array.isArray(postPlatforms) && postPlatforms.length > 0) {
            const firstPlatform = postPlatforms[0];
            if (typeof firstPlatform === 'string') {
              platform = normalizePlatform(firstPlatform);
            } else if (firstPlatform?.platform) {
              platform = normalizePlatform(firstPlatform.platform);
            }
          }

          // Priority 4: Post metadata
          if (platform === 'unknown') {
            const meta = (p as any)?.metadata as any;
            platform = normalizePlatform(meta?.platform ?? 'unknown');
          }
        }
      }

      // Extract media URLs from post metadata or image_url
      const meta = (p as any)?.metadata as any;
      const mediaUrls = meta?.media_urls && Array.isArray(meta.media_urls) ? meta.media_urls : [];
      const imageUrl = (p as any)?.image_url;

      return {
        id: p.id, // Include post ID for unique key generation
        score,
        engagementRate,
        engagement,
        impressions,
        date: analytics?.date ?? (p as any)?.created_at ?? new Date().toISOString(),
        postContent: (p as any)?.content ?? '',
        platform,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : (imageUrl ? [imageUrl] : []),
        imageUrl,
      };
    });
  }
  // If no posts, postsTableData remains undefined and component shows empty state

  return (
    <DashboardWrapper>
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
            followersChange={finalFollowersChange}
            impressionsChange={finalImpressionsChange}
            engagementChange={finalEngagementChange}
            postsChange={finalPostsChange}
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
                    <Heart className="h-5 w-5 text-pink-600" />
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
                    <Eye className="h-5 w-5 text-pink-600" />
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
                    <Users className="h-5 w-5 text-pink-600" />
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
                    <Users className="h-5 w-5 text-pink-600" />
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
                    <FileText className="h-5 w-5 text-pink-600" />
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
                    <Heart className="h-5 w-5 text-pink-600" />
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
    </DashboardWrapper>
  );
}
