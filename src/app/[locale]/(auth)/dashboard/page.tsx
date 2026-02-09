import type { Metadata } from 'next';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear, subDays } from 'date-fns';
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
import { getFollowerStatsFromGetlate } from '@/libs/follower-stats-sync';
import { getGetlateAnalyticsOverview } from '@/libs/getlate-overview';
import { getGetlatePosts } from '@/libs/getlate-posts';
import { calculateScoresForPosts } from '@/libs/post-score-calculator';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { PlatformCards } from './DashboardClient';
import { DashboardWrapper } from './DashboardWrapper';
import { MetricCardsClient } from './MetricCardsClient';

export const metadata: Metadata = {
  title: 'Branda - Dashboard',
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
      case 'currentMonth': {
        return { from: startOfMonth(today), to: today };
      }
      case 'currentYear': {
        return { from: startOfYear(today), to: today };
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
    followerStatsData,
    getlateOverview, // Get overview data from Getlate API (totalPosts, publishedPosts, scheduledPosts)
    getlatePosts, // Get posts directly from Getlate API (exact structure)
  ] = await Promise.all([
    getCachedPosts(supabase, userId, selectedBrandId, rangeFrom, rangeTo),
    getCachedPosts(supabase, userId, selectedBrandId, previousRangeFrom, previousRangeTo),
    getCachedAccounts(supabase, userId, selectedBrandId),
    getCachedDemographics(supabase, userId, selectedBrandId, rangeFrom, rangeTo),
    getFollowerStatsFromGetlate(supabase, userId, selectedBrandId, {
      fromDate: rangeFrom,
      toDate: rangeTo,
      granularity: granularity === 'day' ? 'daily' : granularity === 'week' ? 'weekly' : granularity === 'month' ? 'monthly' : 'daily',
    }),
    getGetlateAnalyticsOverview(supabase, userId, selectedBrandId, {
      fromDate: rangeFrom.toISOString().split('T')[0],
      toDate: rangeTo.toISOString().split('T')[0],
      platform: selectedPlatform || undefined,
    }),
    getGetlatePosts(supabase, userId, selectedBrandId, {
      fromDate: rangeFrom.toISOString().split('T')[0],
      toDate: rangeTo.toISOString().split('T')[0],
      platform: 'all' as any, // Always fetch all platforms - filtering happens in PostsTable component
    }),
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

  // Helper function to deduplicate analytics entries
  // Only keeps one entry per post_id + platform + date combination
  const deduplicateAnalytics = (analytics: Array<any>) => {
    const deduplicationMap = new Map<string, typeof analytics[0]>();
    for (const entry of analytics) {
      const platform = entry.platform || 'unknown';
      const dateKey = entry.date ? new Date(entry.date).toISOString().split('T')[0] : '';
      const uniqueKey = `${entry.post_id}:${platform}:${dateKey}`;

      const existing = deduplicationMap.get(uniqueKey);
      if (!existing) {
        deduplicationMap.set(uniqueKey, entry);
      } else {
        // If we have an updated_at field, prefer the more recent entry
        // Otherwise, prefer the one with higher engagement values (more complete data)
        const existingUpdated = (existing as any).updated_at ? new Date((existing as any).updated_at) : null;
        const currentUpdated = (entry as any).updated_at ? new Date((entry as any).updated_at) : null;

        if (currentUpdated && existingUpdated && currentUpdated > existingUpdated) {
          deduplicationMap.set(uniqueKey, entry);
        } else if (!existingUpdated && !currentUpdated) {
          // If no updated_at, prefer entry with higher total engagement
          const existingEngagement = (Number(existing.likes ?? 0) + Number(existing.comments ?? 0) + Number(existing.shares ?? 0));
          const currentEngagement = (Number(entry.likes ?? 0) + Number(entry.comments ?? 0) + Number(entry.shares ?? 0));
          if (currentEngagement > existingEngagement) {
            deduplicationMap.set(uniqueKey, entry);
          }
        }
      }
    }
    return Array.from(deduplicationMap.values());
  };

  // Posts are already filtered by date range from cache
  // Deduplicate posts by ID to prevent duplicates (e.g., if same post has multiple scheduled_posts entries)
  const postsMap = new Map<string, typeof postsData[0]>();
  if (postsData && Array.isArray(postsData)) {
    for (const post of postsData) {
      if (post?.id && !postsMap.has(post.id)) {
        postsMap.set(post.id, post);
      }
    }
  }
  const dateFilteredPosts = Array.from(postsMap.values());

  // Filter analytics by date range
  // Include analytics that are within the date range (regardless of post publish date)
  // Normalize analytics dates to date-only (midnight) for accurate comparison
  // rangeFrom is already startOfDay, rangeTo is endOfDay, so we compare dates properly
  const normalizeAnalyticsDateToDateOnly = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Normalize rangeFrom to start of day (it already is, but ensure consistency)
  const normalizedRangeFrom = normalizeAnalyticsDateToDateOnly(rangeFrom);
  // For rangeTo, we want to include the entire end day, so compare with start of that day
  const normalizedRangeTo = normalizeAnalyticsDateToDateOnly(rangeTo);

  const dateFilteredAnalyticsRaw = (analyticsData || []).filter((a) => {
    if (!a.date) {
      return false;
    }
    const analyticsDate = normalizeAnalyticsDateToDateOnly(new Date(a.date));
    // Include analytics if date is >= rangeFrom and <= rangeTo (inclusive)
    const isInDateRange = analyticsDate >= normalizedRangeFrom && analyticsDate <= normalizedRangeTo;
    if (!isInDateRange) {
      return false;
    }

    // Only include published posts (External Post IDs)
    // Check metadata for isExternal flag and status
    const metadata = (a.metadata as any) || {};
    const isExternal = metadata.isExternal !== undefined ? metadata.isExternal : true; // Default to true (External Post)
    const status = metadata.platformStatus || metadata.status;

    // Only include if:
    // 1. isExternal is true (synced from platform) OR
    // 2. status is 'published' (published posts)
    // Exclude drafts and scheduled posts that haven't been published yet
    const isPublished = isExternal || status === 'published';

    return isPublished;
  });

  // Deduplicate analytics entries: only keep one entry per post_id + platform + date combination
  // This prevents double-counting when sync creates duplicate entries
  const dateFilteredAnalytics = deduplicateAnalytics(dateFilteredAnalyticsRaw);

  // Aggregate metric sums from date-filtered post_analytics
  let totalImpressions = 0;
  let _totalReach = 0; // Available for future metric cards
  let _totalClicks = 0; // Available for future metric cards
  let _totalViews = 0; // Available for future metric cards
  let totalEngagement = 0;
  let totalFollowers = 0;

  // Count unique published posts (External Post IDs only)
  // Priority: Use Getlate API overview when available (most accurate), otherwise use database
  // dateFilteredAnalytics is already filtered to only published posts
  let totalPosts = 0;

  // If Getlate API overview is available and we have Getlate posts, prioritize Getlate data
  // This ensures consistency between overview count and actual posts displayed
  if (getlateOverview && getlatePosts && getlatePosts.length > 0) {
    // Use Getlate API overview as primary source when Getlate posts are available
    // Filter overview by platform if selected
    if (selectedPlatform && selectedPlatform !== 'all') {
      // When platform is selected, count published posts from Getlate API that match the platform
      const filteredGetlatePosts = getlatePosts.filter((post) => {
        const isPublished = post.status === 'published' || post.isExternal === true;
        if (!isPublished) {
          return false;
        }

        // Check if post matches selected platform
        const normalizedSelectedPlatform = normalizePlatform(selectedPlatform);
        if (post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
          return post.platformAnalytics.some((pa: any) =>
            normalizePlatform(pa.platform || '') === normalizedSelectedPlatform && pa.status === 'published',
          );
        }
        if (post.platforms && Array.isArray(post.platforms)) {
          return post.platforms.some((p: any) =>
            normalizePlatform(p.platform || '') === normalizedSelectedPlatform && p.status === 'published',
          );
        }
        return normalizePlatform(post.platform || '') === normalizedSelectedPlatform;
      });
      totalPosts = new Set(filteredGetlatePosts.map(p => p._id)).size;
    } else {
      // Use Getlate overview publishedPosts count (already filtered by date range)
      totalPosts = getlateOverview.publishedPosts || 0;
    }
  } else {
    // Fallback to database count when Getlate API data is not available
    const uniquePostIds = new Set<string>();
    if (dateFilteredPosts && Array.isArray(dateFilteredPosts)) {
      for (const post of dateFilteredPosts) {
        // Only include published posts
        if (post?.id && post.status === 'published') {
          uniquePostIds.add(post.id);
        }
      }
    }
    // Include posts from analytics (already filtered to published posts only)
    for (const analytics of dateFilteredAnalytics) {
      if (analytics.post_id) {
        uniquePostIds.add(analytics.post_id);
      }
    }
    totalPosts = uniquePostIds.size;

    // Use Getlate API overview as fallback if database count is 0
    if (totalPosts === 0 && getlateOverview && getlateOverview.publishedPosts > 0) {
      totalPosts = getlateOverview.publishedPosts || 0;
    }
  }

  // Calculate totals from analytics
  // Priority: Use Getlate API analytics when Getlate posts are available (most accurate)
  // Otherwise use database analytics
  // Engagement = likes + comments + shares (all engagement types)

  // Check if we should use Getlate API analytics
  const useGetlateAnalytics = getlatePosts && getlatePosts.length > 0;

  if (useGetlateAnalytics) {
    // Calculate metrics from Getlate API posts analytics
    // Getlate posts include analytics directly in the post object
    for (const post of getlatePosts) {
      // Only include published posts (matches totalPosts calculation)
      const isPublished = post.status === 'published' || post.isExternal === true;
      if (!isPublished) {
        continue;
      }

      // Filter by platform if selected
      if (selectedPlatform && selectedPlatform !== 'all') {
        const normalizedSelectedPlatform = normalizePlatform(selectedPlatform);
        let matchesPlatform = false;

        // Check platformAnalytics first (most detailed)
        if (post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
          matchesPlatform = post.platformAnalytics.some((pa: any) =>
            normalizePlatform(pa.platform || '') === normalizedSelectedPlatform && pa.status === 'published',
          );
        }
        // Check platforms array
        if (!matchesPlatform && post.platforms && Array.isArray(post.platforms)) {
          matchesPlatform = post.platforms.some((p: any) =>
            normalizePlatform(p.platform || '') === normalizedSelectedPlatform && p.status === 'published',
          );
        }
        // Check root platform
        if (!matchesPlatform) {
          matchesPlatform = normalizePlatform(post.platform || '') === normalizedSelectedPlatform;
        }

        if (!matchesPlatform) {
          continue;
        }
      }

      // Extract analytics from Getlate post structure
      // Priority: platformAnalytics (per-platform) > platforms array > root analytics
      let analytics: any = post.analytics || {};

      if (selectedPlatform && selectedPlatform !== 'all' && post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
        // Use platform-specific analytics when platform is selected
        const platformAnalytics = post.platformAnalytics.find((pa: any) =>
          normalizePlatform(pa.platform || '') === normalizePlatform(selectedPlatform) && pa.status === 'published',
        );
        if (platformAnalytics?.analytics) {
          analytics = platformAnalytics.analytics;
        }
      } else if (post.platformAnalytics && Array.isArray(post.platformAnalytics) && post.platformAnalytics.length > 0) {
        // Aggregate all platform analytics when "all" is selected
        const aggregatedAnalytics = {
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          reach: 0,
          clicks: 0,
          views: 0,
        };

        for (const pa of post.platformAnalytics) {
          if (pa.status === 'published' && pa.analytics) {
            aggregatedAnalytics.impressions += Number(pa.analytics.impressions || 0);
            aggregatedAnalytics.likes += Number(pa.analytics.likes || 0);
            aggregatedAnalytics.comments += Number(pa.analytics.comments || 0);
            aggregatedAnalytics.shares += Number(pa.analytics.shares || 0);
            aggregatedAnalytics.reach += Number(pa.analytics.reach || 0);
            aggregatedAnalytics.clicks += Number(pa.analytics.clicks || 0);
            aggregatedAnalytics.views += Number(pa.analytics.views || 0);
          }
        }
        analytics = aggregatedAnalytics;
      } else if (post.platforms && Array.isArray(post.platforms) && post.platforms.length > 0) {
        // Aggregate from platforms array
        const aggregatedAnalytics = {
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          reach: 0,
          clicks: 0,
          views: 0,
        };

        for (const p of post.platforms) {
          if (p.status === 'published' && p.analytics) {
            aggregatedAnalytics.impressions += Number(p.analytics.impressions || 0);
            aggregatedAnalytics.likes += Number(p.analytics.likes || 0);
            aggregatedAnalytics.comments += Number(p.analytics.comments || 0);
            aggregatedAnalytics.shares += Number(p.analytics.shares || 0);
            aggregatedAnalytics.reach += Number(p.analytics.reach || 0);
            aggregatedAnalytics.clicks += Number(p.analytics.clicks || 0);
            aggregatedAnalytics.views += Number(p.analytics.views || 0);
          }
        }
        analytics = aggregatedAnalytics;
      }

      // Aggregate metrics from Getlate analytics
      totalImpressions += Number(analytics.impressions ?? 0);
      _totalReach += Number(analytics.reach ?? 0);
      _totalClicks += Number(analytics.clicks ?? 0);
      _totalViews += Number(analytics.views ?? 0);
      const likes = Number(analytics.likes ?? 0);
      const comments = Number(analytics.comments ?? 0);
      const shares = Number(analytics.shares ?? 0);
      totalEngagement += likes + comments + shares;
    }
  } else {
    // Fallback to database analytics when Getlate API data is not available
    for (const analytics of dateFilteredAnalytics) {
      totalImpressions += Number(analytics.impressions ?? 0);
      // Extract reach, clicks, views from metadata (stored by sync function)
      const metadata = (analytics.metadata as any) || {};
      _totalReach += Number(metadata.reach ?? 0);
      _totalClicks += Number(metadata.clicks ?? 0);
      _totalViews += Number(metadata.views ?? 0);
      // Ensure we're using the correct field names and handling null/undefined
      const likes = Number(analytics.likes ?? 0);
      const comments = Number(analytics.comments ?? 0);
      const shares = Number(analytics.shares ?? 0);
      totalEngagement += likes + comments + shares;
    }
  }

  // Get followers from platform_specific_data - sum across all accounts/platforms
  // Group by platform and take max per platform (in case multiple accounts on same platform)
  const followersByPlatform = new Map<string, number>();
  if (_accountsData && Array.isArray(_accountsData)) {
    for (const acc of _accountsData) {
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
  }

  // Sum followers across all platforms
  for (const followers of followersByPlatform.values()) {
    totalFollowers += followers;
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

  // Build platform map from Getlate API analytics when available
  if (useGetlateAnalytics && getlatePosts) {
    for (const post of getlatePosts) {
      // Only include published posts
      const isPublished = post.status === 'published' || post.isExternal === true;
      if (!isPublished) {
        continue;
      }

      const postId = post._id || '';
      if (!postId) {
        continue;
      }

      // Use platformAnalytics for most accurate per-platform data
      if (post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
        for (const pa of post.platformAnalytics) {
          if (pa.status !== 'published') {
            continue;
          }

          const plat = normalizePlatform(pa.platform || '');
          if (plat === 'unknown') {
            continue;
          }

          // Add to post platform map
          if (!postPlatformMap.has(postId)) {
            postPlatformMap.set(postId, new Set());
          }
          postPlatformMap.get(postId)!.add(plat);

          // Aggregate metrics by platform from Getlate analytics
          const existingEntry = platformMap.get(plat);
          const entry = existingEntry ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
          entry.followers = existingEntry?.followers ?? 0; // Preserve followers from accounts

          const analytics = pa.analytics || {};
          entry.impressions += Number(analytics.impressions ?? 0);
          const likes = Number(analytics.likes ?? 0);
          const comments = Number(analytics.comments ?? 0);
          const shares = Number(analytics.shares ?? 0);
          entry.engagement += likes + comments + shares;
          platformMap.set(plat, entry);
        }
      } else if (post.platforms && Array.isArray(post.platforms)) {
        // Fallback to platforms array
        for (const p of post.platforms) {
          if (p.status !== 'published') {
            continue;
          }

          const plat = normalizePlatform(p.platform || '');
          if (plat === 'unknown') {
            continue;
          }

          if (!postPlatformMap.has(postId)) {
            postPlatformMap.set(postId, new Set());
          }
          postPlatformMap.get(postId)!.add(plat);

          const existingEntry = platformMap.get(plat);
          const entry = existingEntry ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
          entry.followers = existingEntry?.followers ?? 0;

          const analytics = p.analytics || {};
          entry.impressions += Number(analytics.impressions ?? 0);
          const likes = Number(analytics.likes ?? 0);
          const comments = Number(analytics.comments ?? 0);
          const shares = Number(analytics.shares ?? 0);
          entry.engagement += likes + comments + shares;
          platformMap.set(plat, entry);
        }
      } else {
        // Fallback to root platform
        const plat = normalizePlatform(post.platform || 'unknown');
        if (plat !== 'unknown') {
          if (!postPlatformMap.has(postId)) {
            postPlatformMap.set(postId, new Set());
          }
          postPlatformMap.get(postId)!.add(plat);

          const existingEntry = platformMap.get(plat);
          const entry = existingEntry ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
          entry.followers = existingEntry?.followers ?? 0;

          const analytics = post.analytics || {};
          entry.impressions += Number(analytics.impressions ?? 0);
          const likes = Number(analytics.likes ?? 0);
          const comments = Number(analytics.comments ?? 0);
          const shares = Number(analytics.shares ?? 0);
          entry.engagement += likes + comments + shares;
          platformMap.set(plat, entry);
        }
      }
    }
  }

  // Fallback to database analytics when Getlate API data is not available
  if (!useGetlateAnalytics && dateFilteredAnalytics && Array.isArray(dateFilteredAnalytics)) {
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

  // Count posts from Getlate API when available
  if (useGetlateAnalytics && getlatePosts) {
    for (const post of getlatePosts) {
      // Only include published posts
      const isPublished = post.status === 'published' || post.isExternal === true;
      if (!isPublished) {
        continue;
      }

      const postId = post._id || '';
      if (!postId) {
        continue;
      }

      // Determine platforms from Getlate post structure
      let platforms: string[] = [];

      // Priority: platformAnalytics > platforms array > root platform
      if (post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
        platforms = post.platformAnalytics
          .filter((pa: any) => pa.status === 'published')
          .map((pa: any) => normalizePlatform(pa.platform || ''));
      } else if (post.platforms && Array.isArray(post.platforms)) {
        platforms = post.platforms
          .filter((p: any) => p.status === 'published')
          .map((p: any) => normalizePlatform(p.platform || ''));
      } else {
        const plat = normalizePlatform(post.platform || 'unknown');
        if (plat !== 'unknown') {
          platforms = [plat];
        }
      }

      // Count post for each platform it belongs to (but only once per platform)
      for (const plat of platforms) {
        if (plat === 'unknown') {
          continue;
        }

        if (!postsCountedPerPlatform.has(plat)) {
          postsCountedPerPlatform.set(plat, new Set());
        }

        if (!postsCountedPerPlatform.get(plat)!.has(postId)) {
          const existingEntry = platformMap.get(plat);
          const entry = existingEntry ?? { followers: 0, impressions: 0, posts: 0, engagement: 0 };
          if (existingEntry) {
            entry.followers = existingEntry.followers;
            entry.impressions = existingEntry.impressions;
            entry.engagement = existingEntry.engagement;
          }
          entry.posts += 1;
          platformMap.set(plat, entry);
          postsCountedPerPlatform.get(plat)!.add(postId);
        }
      }
    }
  }

  // Fallback to database posts when Getlate API data is not available
  if (!useGetlateAnalytics && dateFilteredPosts && Array.isArray(dateFilteredPosts)) {
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
  const buildSeriesMap = (analytics: typeof analyticsData): Record<string, { followers: number; impressions: number; count: number; engagement: number; engagementRate: number }> => {
    const map: Record<string, { followers: number; impressions: number; count: number; engagement: number; engagementRate: number }> = {};

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
        map[key] = { followers: 0, impressions: 0, count: 0, engagement: 0, engagementRate: 0 };
      }

      map[key].impressions += Number(a.impressions ?? 0);
      // Calculate engagement: likes + comments + shares
      const likes = Number(a.likes ?? 0);
      const comments = Number(a.comments ?? 0);
      const shares = Number(a.shares ?? 0);
      const engagement = likes + comments + shares;
      map[key].engagement += engagement;
      map[key].count += 1;

      // Calculate engagement rate from metadata if available, otherwise calculate
      const metadata = (a.metadata as any) || {};
      const engagementRateFromMetadata = metadata.engagementRate !== undefined ? Number(metadata.engagementRate) : null;
      const impressions = Number(a.impressions ?? 0);
      const calculatedRate = engagementRateFromMetadata !== null
        ? engagementRateFromMetadata
        : (impressions > 0 ? (engagement / impressions) * 100 : 0);

      // Average engagement rate (will be recalculated per date key)
      map[key].engagementRate = calculatedRate;

      // Note: Followers will be set from platformMap after building the series map
      // This ensures we use the correct followers from accounts, not post metadata
    }

    // Recalculate engagement rate per date key (average of all posts for that date)
    for (const key in map) {
      const data = map[key];
      if (data && data.count > 0 && data.impressions > 0) {
        // Recalculate as total engagement / total impressions for that date
        data.engagementRate = (data.engagement / data.impressions) * 100;
      }
    }

    return map;
  };

  // Helper function to build series map from Getlate API posts
  const buildSeriesMapFromGetlate = (posts: typeof getlatePosts, platformFilter?: string | null): Record<string, { followers: number; impressions: number; count: number; engagement: number; engagementRate: number }> => {
    const map: Record<string, { followers: number; impressions: number; count: number; engagement: number; engagementRate: number }> = {};

    if (!posts || !Array.isArray(posts)) {
      return map;
    }

    const normalizedPlatformFilter = platformFilter && platformFilter !== 'all' ? normalizePlatform(platformFilter) : null;

    for (const post of posts) {
      // Only include published posts
      const isPublished = post.status === 'published' || post.isExternal === true;
      if (!isPublished) {
        continue;
      }

      // Filter by platform if specified
      if (normalizedPlatformFilter) {
        let matchesPlatform = false;
        if (post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
          matchesPlatform = post.platformAnalytics.some((pa: any) =>
            normalizePlatform(pa.platform || '') === normalizedPlatformFilter && pa.status === 'published',
          );
        } else if (post.platforms && Array.isArray(post.platforms)) {
          matchesPlatform = post.platforms.some((p: any) =>
            normalizePlatform(p.platform || '') === normalizedPlatformFilter && p.status === 'published',
          );
        } else {
          matchesPlatform = normalizePlatform(post.platform || '') === normalizedPlatformFilter;
        }
        if (!matchesPlatform) {
          continue;
        }
      }

      // Get publish date for grouping
      const publishDate = post.publishedAt ? new Date(post.publishedAt) : null;
      if (!publishDate) {
        continue;
      }

      const key = getGranularityKey(publishDate);

      if (!map[key]) {
        map[key] = { followers: 0, impressions: 0, count: 0, engagement: 0, engagementRate: 0 };
      }

      // Extract analytics from Getlate post structure
      let analytics: any = {};
      if (normalizedPlatformFilter && post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
        const platformAnalytics = post.platformAnalytics.find((pa: any) =>
          normalizePlatform(pa.platform || '') === normalizedPlatformFilter && pa.status === 'published',
        );
        analytics = platformAnalytics?.analytics || {};
      } else if (post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
        // Aggregate all platform analytics
        const aggregated = {
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        };
        for (const pa of post.platformAnalytics) {
          if (pa.status === 'published' && pa.analytics) {
            aggregated.impressions += Number(pa.analytics.impressions || 0);
            aggregated.likes += Number(pa.analytics.likes || 0);
            aggregated.comments += Number(pa.analytics.comments || 0);
            aggregated.shares += Number(pa.analytics.shares || 0);
          }
        }
        analytics = aggregated;
      } else if (post.platforms && Array.isArray(post.platforms)) {
        // Aggregate from platforms array
        const aggregated = {
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        };
        for (const p of post.platforms) {
          if (p.status === 'published' && p.analytics) {
            aggregated.impressions += Number(p.analytics.impressions || 0);
            aggregated.likes += Number(p.analytics.likes || 0);
            aggregated.comments += Number(p.analytics.comments || 0);
            aggregated.shares += Number(p.analytics.shares || 0);
          }
        }
        analytics = aggregated;
      } else {
        analytics = post.analytics || {};
      }

      map[key].impressions += Number(analytics.impressions ?? 0);
      const likes = Number(analytics.likes ?? 0);
      const comments = Number(analytics.comments ?? 0);
      const shares = Number(analytics.shares ?? 0);
      const engagement = likes + comments + shares;
      map[key].engagement += engagement;
      map[key].count += 1;

      // Calculate engagement rate
      const impressions = Number(analytics.impressions ?? 0);
      const engagementRateFromAPI = analytics.engagementRate !== undefined && analytics.engagementRate !== null
        ? Number(analytics.engagementRate)
        : null;
      const calculatedRate = engagementRateFromAPI !== null
        ? engagementRateFromAPI
        : (impressions > 0 ? (engagement / impressions) * 100 : 0);
      map[key].engagementRate = calculatedRate;
    }

    // Recalculate engagement rate per date key
    for (const key in map) {
      const data = map[key];
      if (data && data.count > 0 && data.impressions > 0) {
        data.engagementRate = (data.engagement / data.impressions) * 100;
      }
    }

    return map;
  };

  // Build series map from Getlate API posts when available, otherwise use database analytics
  const seriesMap = useGetlateAnalytics && getlatePosts
    ? buildSeriesMapFromGetlate(getlatePosts)
    : buildSeriesMap(dateFilteredAnalytics);

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
  let _filteredReach = 0; // Available for future metric cards
  let _filteredClicks = 0; // Available for future metric cards
  let _filteredViews = 0; // Available for future metric cards
  let filteredEngagement = 0;
  let filteredFollowers = 0;

  // Count unique filtered posts from both posts table and analytics
  const uniqueFilteredPostIds = new Set<string>();
  if (finalFilteredPosts && Array.isArray(finalFilteredPosts)) {
    for (const post of finalFilteredPosts) {
      if (post?.id) {
        uniqueFilteredPostIds.add(post.id);
      }
    }
  }
  // Also include posts that have analytics but might not be in posts table
  for (const analytics of finalFilteredAnalytics) {
    if (analytics.post_id) {
      uniqueFilteredPostIds.add(analytics.post_id);
    }
  }
  const filteredPostsCount = uniqueFilteredPostIds.size;

  // Calculate from filtered analytics (only analytics for the selected platform)
  for (const a of finalFilteredAnalytics) {
    filteredImpressions += Number(a.impressions ?? 0);
    // Extract reach, clicks, views from metadata
    const metadata = (a.metadata as any) || {};
    _filteredReach += Number(metadata.reach ?? 0);
    _filteredClicks += Number(metadata.clicks ?? 0);
    _filteredViews += Number(metadata.views ?? 0);
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
  // Note: reach, clicks, and views are calculated and displayed in the PostsTable component per post
  // Aggregate totals (_totalReach, _totalClicks, _totalViews) are available if needed for future metric cards
  const displayEngagement = selectedPlatform && selectedPlatform !== 'all' ? filteredEngagement : totalEngagement;
  const displayFollowers = selectedPlatform && selectedPlatform !== 'all' ? filteredFollowers : totalFollowers;

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

  // Build filtered series map using Getlate API posts when available, otherwise use database analytics
  const filteredSeriesMap = useGetlateAnalytics && getlatePosts
    ? buildSeriesMapFromGetlate(getlatePosts, selectedPlatform)
    : buildSeriesMap(finalFilteredAnalytics);

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

  // Generate follower trend series from Getlate API follower stats
  // Use real historical data from Getlate if available, otherwise fallback to current snapshot
  let followerTrendSeries: Array<{ date: string; followers: number }> = [];

  if (followerStatsData && followerStatsData.followerTrend && followerStatsData.followerTrend.length > 0) {
    // Use real follower stats from Getlate API
    // Map Getlate data to match date series granularity
    const followerStatsMap = new Map<string, number>();
    for (const stat of followerStatsData.followerTrend) {
      const statDate = new Date(stat.date);
      let key: string;

      switch (granularity) {
        case 'day':
          key = format(statDate, 'yyyy-MM-dd');
          break;
        case 'week':
          key = format(startOfDay(statDate), 'yyyy-MM-dd');
          break;
        case 'month':
          key = format(startOfMonth(statDate), 'yyyy-MM');
          break;
        case 'year':
          key = format(statDate, 'yyyy');
          break;
        default:
          key = format(statDate, 'yyyy-MM-dd');
      }

      // For same key, take the maximum (latest) follower count
      const existing = followerStatsMap.get(key) || 0;
      followerStatsMap.set(key, Math.max(existing, stat.followers));
    }

    // Generate series matching dateSeries keys
    followerTrendSeries = dateSeries.map((dateKey) => {
      const followers = followerStatsMap.get(dateKey) || 0;
      return {
        date: dateKey,
        followers,
      };
    });

    // If no data for some dates, interpolate or use last known value
    let lastKnownFollowers = 0;
    for (let i = 0; i < followerTrendSeries.length; i++) {
      const current = followerTrendSeries[i];
      if (current && current.followers === 0 && lastKnownFollowers > 0) {
        current.followers = lastKnownFollowers;
      } else if (current && current.followers > 0) {
        lastKnownFollowers = current.followers;
      }
    }
  } else {
    // Fallback: Use displayFollowers (current snapshot) for all dates
    followerTrendSeries = dateSeries.map((dateKey) => {
      return {
        date: dateKey,
        followers: displayFollowers || 0,
      };
    });
  }

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

  // Recalculate totalPosts to match "All Platforms" count
  // Sum all platform-specific counts (each platform occurrence counts separately)
  // This ensures "Total Posts" matches the sum of individual platform cards
  const sumOfPlatformPosts = Array.from(platformPostsCount.values()).reduce((sum, count) => sum + count, 0);
  if (sumOfPlatformPosts > 0) {
    totalPosts = sumOfPlatformPosts;
  }
  // If no platform posts but we have a totalPosts from earlier calculation, keep it
  // This handles edge cases where platformPostsCount might be empty but posts exist

  // Calculate growth/change percentages using follower stats from Getlate API
  // Use real growth data from Getlate if available
  const followerStatsAccounts = followerStatsData && 'accounts' in followerStatsData ? followerStatsData.accounts : undefined;
  if (followerStatsAccounts && Array.isArray(followerStatsAccounts) && followerStatsAccounts.length > 0) {
    // Map account growth data by platform
    const accountGrowthMap = new Map<string, { growth: number; growthPercentage: number }>();
    for (const account of followerStatsAccounts) {
      const plat = normalizePlatform(account.platform);
      const existing = accountGrowthMap.get(plat);
      // Sum growth across all accounts on the same platform
      if (existing) {
        accountGrowthMap.set(plat, {
          growth: existing.growth + (account.growth || 0),
          growthPercentage: existing.growthPercentage + (account.growthPercentage || 0),
        });
      } else {
        accountGrowthMap.set(plat, {
          growth: account.growth || 0,
          growthPercentage: account.growthPercentage || 0,
        });
      }
    }

    // Update platform followers map with real growth data
    for (const [plat, data] of platformFollowersMap.entries()) {
      const growthData = accountGrowthMap.get(plat);
      if (growthData) {
        platformFollowersMap.set(plat, {
          ...data,
          change: growthData.growthPercentage, // Use percentage change
        });
      }
    }
  } else {
    // Fallback: Calculate change from follower trend if available
    if (followerTrendSeries.length > 1) {
      const firstFollowers = followerTrendSeries[0]?.followers || 0;
      const lastFollowers = followerTrendSeries[followerTrendSeries.length - 1]?.followers || 0;
      const totalGrowth = lastFollowers - firstFollowers;
      const totalGrowthPercentage = firstFollowers > 0 ? (totalGrowth / firstFollowers) * 100 : 0;

      // Distribute growth percentage across platforms proportionally
      for (const [plat, data] of platformFollowersMap.entries()) {
        if (data.followers > 0 && totalFollowers > 0) {
          const platformShare = data.followers / totalFollowers;
          const platformGrowthPercentage = totalGrowthPercentage * platformShare;
          platformFollowersMap.set(plat, {
            ...data,
            change: platformGrowthPercentage,
          });
        }
      }
    }
  }

  // Generate net follower growth from Getlate API follower stats
  // Use real growth data from Getlate if available, otherwise calculate from follower trend
  let netGrowthSeries: Array<{ date: string; growth: number }> = [];

  if (followerStatsData && followerStatsData.netGrowth && followerStatsData.netGrowth.length > 0) {
    // Use real net growth data from Getlate API
    // Map Getlate data to match date series granularity
    const growthStatsMap = new Map<string, number>();
    for (const stat of followerStatsData.netGrowth) {
      const statDate = new Date(stat.date);
      let key: string;

      switch (granularity) {
        case 'day':
          key = format(statDate, 'yyyy-MM-dd');
          break;
        case 'week':
          key = format(startOfDay(statDate), 'yyyy-MM-dd');
          break;
        case 'month':
          key = format(startOfMonth(statDate), 'yyyy-MM');
          break;
        case 'year':
          key = format(statDate, 'yyyy');
          break;
        default:
          key = format(statDate, 'yyyy-MM-dd');
      }

      // Sum growth for same key (multiple accounts)
      const existing = growthStatsMap.get(key) || 0;
      growthStatsMap.set(key, existing + stat.growth);
    }

    // Generate series matching dateSeries keys
    // Use absolute value to show positive growth values
    netGrowthSeries = dateSeries.map((dateKey) => {
      const growth = growthStatsMap.get(dateKey) || 0;
      return {
        date: dateKey,
        growth: Math.abs(growth), // Always show positive values
      };
    });
  } else if (followerTrendSeries.length > 0) {
    // Calculate growth from follower trend (day-to-day change)
    netGrowthSeries = followerTrendSeries.map((current, index) => {
      if (index === 0) {
        return {
          date: current.date,
          growth: 0, // No previous day to compare
        };
      }
      const previous = followerTrendSeries[index - 1];
      if (!previous) {
        return {
          date: current.date,
          growth: 0,
        };
      }
      const growth = current.followers - previous.followers;
      return {
        date: current.date,
        growth: Math.abs(growth), // Always show positive values
      };
    });
  } else {
    // Fallback: Show zeros if no data available
    netGrowthSeries = dateSeries.map((dateKey) => {
      return {
        date: dateKey,
        growth: 0,
      };
    });
  }

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
  // Use engagementRate from series map (calculated from actual analytics data)
  const engagementRateSeries = dateSeries.map((dateKey) => {
    const seriesData = activeSeriesMap[dateKey] || filteredSeriesMap[dateKey];
    let rate = 0;
    if (seriesData) {
      // Use stored engagementRate if available, otherwise calculate
      if (seriesData.engagementRate !== undefined && seriesData.engagementRate > 0) {
        rate = seriesData.engagementRate;
      } else if (seriesData.impressions > 0) {
        rate = (seriesData.engagement / seriesData.impressions) * 100;
      }
    }
    return {
      date: dateKey,
      rate: Math.round(rate * 10) / 10,
    };
  });

  // Calculate previous period metrics for comparison
  // Filter previous analytics by date range
  // Use same normalization function for consistency
  const normalizedPreviousRangeFrom = normalizeAnalyticsDateToDateOnly(previousRangeFrom);
  const normalizedPreviousRangeTo = normalizeAnalyticsDateToDateOnly(previousRangeTo);

  const previousDateFilteredAnalyticsRaw = (previousAnalyticsData || []).filter((a) => {
    if (!a.date) {
      return false;
    }
    const analyticsDate = normalizeAnalyticsDateToDateOnly(new Date(a.date));
    return analyticsDate >= normalizedPreviousRangeFrom && analyticsDate <= normalizedPreviousRangeTo;
  });

  // Deduplicate previous period analytics entries
  const previousDateFilteredAnalytics = deduplicateAnalytics(previousDateFilteredAnalyticsRaw);

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

  // Count unique previous period posts from both posts table and analytics
  // Only include published posts (matching current period logic)
  const uniquePreviousPostIds = new Set<string>();
  if (previousDateFilteredPosts && Array.isArray(previousDateFilteredPosts)) {
    for (const post of previousDateFilteredPosts) {
      // Only include published posts (matching current period logic)
      if (post?.id && post.status === 'published') {
        uniquePreviousPostIds.add(post.id);
      }
    }
  }
  // Also include posts that have analytics but might not be in posts table
  // previousDateFilteredAnalytics is already filtered to published posts only
  for (const analytics of previousDateFilteredAnalytics) {
    if (analytics.post_id) {
      uniquePreviousPostIds.add(analytics.post_id);
    }
  }
  previousTotalPosts = uniquePreviousPostIds.size;

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
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    reach: number;
    clicks: number;
    views: number;
    date: string;
    postContent: string;
    platform: string;
    mediaUrls?: string[];
    imageUrl?: string;
    platformPostUrl?: string | null;
  }> | undefined;

  // Generate filtered posts table data from Getlate API posts (exact structure)
  // If Getlate API posts are available, use them directly; otherwise fallback to database posts
  // Note: getlatePosts already includes all pages and is filtered by date range and platform from API
  // We only need to filter for published posts to match the overview count
  if (getlatePosts && getlatePosts.length > 0) {
    // Filter for published posts only (matches getlateOverview.publishedPosts count)
    // The API already filters by date range and platform, so we only need to check status
    const filteredGetlatePosts = getlatePosts.filter((post) => {
      // Only include published posts (External Post IDs)
      // Check status and isExternal flag - this matches what Getlate API counts as "publishedPosts"
      const isPublished = post.status === 'published' || post.isExternal === true;
      return isPublished;
    });

    // Collect posts for scoring
    const postsForScoring = filteredGetlatePosts.map((post: any) => {
      // Extract analytics from Getlate API structure
      // Priority: platformAnalytics (detailed) > platforms array > top-level analytics
      let analytics = post.analytics;
      if (post.platformAnalytics && post.platformAnalytics.length > 0) {
        // Use first platform's analytics (or aggregate if needed)
        analytics = post.platformAnalytics[0].analytics;
      } else if (post.platforms && post.platforms.length > 0) {
        // Use first platform's analytics from platforms array
        analytics = post.platforms[0].analytics;
      }

      // Extract metrics for scoring (ensure numbers)
      const impressions = Number(analytics.impressions || 0);
      const likes = Number(analytics.likes || 0);
      const comments = Number(analytics.comments || 0);
      const shares = Number(analytics.shares || 0);
      const engagement = likes + comments + shares;

      // Calculate engagement rate for scoring
      // Use from API if available, otherwise calculate
      const engagementRateFromAPI = analytics.engagementRate !== undefined && analytics.engagementRate !== null
        ? Number(analytics.engagementRate)
        : null;

      const engagementRate = engagementRateFromAPI !== null
        ? engagementRateFromAPI
        : (impressions > 0 ? (engagement / impressions) * 100 : 0);

      // Extract media URLs from Getlate API structure and normalize for consistent rendering
      const rawMediaUrlsForScoring: string[] = [];
      if (post.thumbnailUrl) {
        rawMediaUrlsForScoring.push(String(post.thumbnailUrl).trim());
      }
      if (post.mediaItems && Array.isArray(post.mediaItems)) {
        for (const item of post.mediaItems) {
          if (typeof item === 'object' && item !== null && 'url' in item) {
            const url = String((item as any).url).trim();
            if (url && url.length > 0 && !rawMediaUrlsForScoring.includes(url)) {
              rawMediaUrlsForScoring.push(url);
            }
          }
        }
      }

      // Normalize and sort URLs to prevent hydration mismatch
      const mediaUrls = rawMediaUrlsForScoring
        .filter((url): url is string => Boolean(url && typeof url === 'string' && url.length > 0))
        .sort((a: string, b: string) => {
          // Sort by normalized URL (without query params) for consistency
          try {
            const urlA = new URL(a);
            const urlB = new URL(b);
            const normalizedA = `${urlA.origin}${urlA.pathname}`;
            const normalizedB = `${urlB.origin}${urlB.pathname}`;
            return normalizedA.localeCompare(normalizedB);
          } catch {
            // If URL parsing fails, sort by original strings
            return a.localeCompare(b);
          }
        });

      return {
        id: post._id, // Use External Post ID
        platform: normalizePlatform(post.platform || 'unknown'),
        metadata: post.metadata || {},
        mediaUrls,
        metrics: {
          impressions,
          engagement,
          engagementRate,
        },
      };
    });

    // Calculate smart scores (returns Map<string, number>)
    const smartScores = calculateScoresForPosts(postsForScoring);

    // Generate table data from Getlate API posts - expand to one row per platform
    const expandedPosts: typeof postsTableData = [];

    for (const post of filteredGetlatePosts) {
      // Extract media URLs (shared across all platforms)
      const rawMediaUrls: string[] = [];
      if (post.thumbnailUrl) {
        rawMediaUrls.push(String(post.thumbnailUrl).trim());
      }
      if (post.mediaItems && Array.isArray(post.mediaItems)) {
        for (const item of post.mediaItems) {
          if (typeof item === 'object' && item !== null && 'url' in item) {
            const url = String((item as any).url).trim();
            if (url && url.length > 0 && !rawMediaUrls.includes(url)) {
              rawMediaUrls.push(url);
            }
          }
        }
      }

      // Normalize and sort URLs to prevent hydration mismatch
      const mediaUrls = rawMediaUrls
        .filter((url): url is string => Boolean(url && typeof url === 'string' && url.length > 0))
        .sort((a: string, b: string) => {
          try {
            const urlA = new URL(a);
            const urlB = new URL(b);
            const normalizedA = `${urlA.origin}${urlA.pathname}`;
            const normalizedB = `${urlB.origin}${urlB.pathname}`;
            return normalizedA.localeCompare(normalizedB);
          } catch {
            return a.localeCompare(b);
          }
        });

      // Get base score (will be same for all platforms of this post)
      const baseScore = smartScores.get(post._id) || 0;

      // Determine which platforms to show
      // Priority: platformAnalytics > platforms array > single platform
      let platformsToProcess: Array<{
        platform: string;
        status: string;
        analytics: any;
        platformPostUrl?: string;
      }> = [];

      if (post.platformAnalytics && Array.isArray(post.platformAnalytics) && post.platformAnalytics.length > 0) {
        // Use platformAnalytics (most detailed, per-platform data)
        // Try to find platformPostUrl from platforms array or root level
        platformsToProcess = post.platformAnalytics.map((pa: any) => {
          const platformName = pa.platform || 'unknown';
          // Try to find platformPostUrl from platforms array
          let platformPostUrl: string | undefined;
          if (post.platforms && Array.isArray(post.platforms)) {
            const matchingPlatform = post.platforms.find((p: any) =>
              (p.platform || '').toLowerCase() === platformName.toLowerCase(),
            );
            if (matchingPlatform?.platformPostUrl) {
              platformPostUrl = matchingPlatform.platformPostUrl;
            }
          }
          // Fallback to root level platformPostUrl if platform matches
          if (!platformPostUrl && post.platformPostUrl
            && normalizePlatform(post.platform || '') === normalizePlatform(platformName)) {
            platformPostUrl = post.platformPostUrl;
          }

          return {
            platform: platformName,
            status: pa.status || 'unknown',
            analytics: pa.analytics || {},
            platformPostUrl,
          };
        });
      } else if (post.platforms && Array.isArray(post.platforms) && post.platforms.length > 0) {
        // Use platforms array (simplified per-platform data)
        platformsToProcess = post.platforms.map((p: any) => ({
          platform: p.platform || 'unknown',
          status: p.status || 'unknown',
          analytics: p.analytics || {},
          platformPostUrl: p.platformPostUrl || undefined,
        }));
      } else {
        // Fallback to single platform (root level)
        platformsToProcess = [{
          platform: post.platform || 'unknown',
          status: post.status || 'unknown',
          analytics: post.analytics || {},
          platformPostUrl: post.platformPostUrl || undefined,
        }];
      }

      // Create one row per platform, only for published platforms
      for (const platformData of platformsToProcess) {
        // Only show successfully published platforms
        if (platformData.status !== 'published') {
          continue;
        }

        const platform = normalizePlatform(platformData.platform);
        const analytics = platformData.analytics;

        // Extract metrics from platform-specific analytics
        const impressions = Number(analytics.impressions || 0);
        const likes = Number(analytics.likes || 0);
        const comments = Number(analytics.comments || 0);
        const shares = Number(analytics.shares || 0);
        const reach = Number(analytics.reach || 0);
        const clicks = Number(analytics.clicks || 0);
        const views = Number(analytics.views || 0);

        // Calculate engagement
        const engagement = likes + comments + shares;

        // Calculate engagement rate
        const engagementRateFromAPI = analytics.engagementRate !== undefined && analytics.engagementRate !== null
          ? Number(analytics.engagementRate)
          : null;

        const engagementRate = engagementRateFromAPI !== null
          ? engagementRateFromAPI
          : (impressions > 0 ? (engagement / impressions) * 100 : 0);

        const roundedEngagementRate = Math.round(engagementRate * 100) / 100;

        // Get platform-specific URL
        const platformPostUrl = platformData.platformPostUrl || post.platformPostUrl || null;

        expandedPosts.push({
          id: `${post._id}-${platform}`, // Unique ID per platform
          score: Math.round(baseScore),
          engagementRate: roundedEngagementRate,
          engagement,
          likes,
          comments,
          shares,
          impressions,
          reach,
          clicks,
          views,
          date: post.publishedAt || post.scheduledFor || new Date().toISOString(),
          postContent: post.content || '',
          platform,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          imageUrl: post.thumbnailUrl || undefined,
          platformPostUrl, // Platform-specific URL
        });
      }
    }

    // Filter expandedPosts by platform if selectedPlatform is set
    // This ensures postsTableData matches the platform filter from URL params
    let filteredExpandedPosts = expandedPosts;
    if (selectedPlatform && selectedPlatform !== 'all') {
      const normalizedSelectedPlatform = normalizePlatform(selectedPlatform);
      filteredExpandedPosts = expandedPosts.filter(row =>
        normalizePlatform(row.platform || '') === normalizedSelectedPlatform,
      );
    }

    postsTableData = filteredExpandedPosts;

    // Recalculate totalPosts based on platform-specific counts to match "All Platforms"
    // Count platform occurrences (rows in table) instead of unique post IDs
    // This ensures "Total Posts" matches the sum of platform cards
    if (selectedPlatform && selectedPlatform !== 'all') {
      // When platform is selected, use that platform's count
      const normalizedSelectedPlatform = normalizePlatform(selectedPlatform);
      totalPosts = platformPostsCount.get(normalizedSelectedPlatform) || 0;
    } else {
      // When "all" is selected, sum all platform-specific counts
      const sumOfPlatformPosts = Array.from(platformPostsCount.values()).reduce((sum, count) => sum + count, 0);
      totalPosts = sumOfPlatformPosts > 0 ? sumOfPlatformPosts : filteredExpandedPosts.length;
    }
  } else if ((finalFilteredPosts && finalFilteredPosts.length > 0) || (finalFilteredAnalytics && finalFilteredAnalytics.length > 0)) {
    // Fallback: Use database posts if Getlate API posts are not available
    // Create a map of post_id -> latest analytics for quick lookup
    type AnalyticsEntry = { post_id: string; likes: number | null; comments: number | null; shares: number | null; impressions: number | null; date: string; metadata: any; platform?: string | null };
    const latestAnalyticsByPost = new Map<string, AnalyticsEntry>();
    // Also create a map of post_id -> all analytics entries to search for platformPostUrl
    const allAnalyticsByPost = new Map<string, AnalyticsEntry[]>();
    for (const analytics of finalFilteredAnalytics) {
      // Track latest entry
      const existing = latestAnalyticsByPost.get(analytics.post_id);
      if (!existing || (analytics.date && existing.date && new Date(analytics.date) > new Date(existing.date))) {
        latestAnalyticsByPost.set(analytics.post_id, analytics);
      }
      // Track all entries
      if (!allAnalyticsByPost.has(analytics.post_id)) {
        allAnalyticsByPost.set(analytics.post_id, []);
      }
      allAnalyticsByPost.get(analytics.post_id)!.push(analytics);
    }

    // Create a map of post_id -> post for quick lookup
    const postsById = new Map<string, any>();
    if (finalFilteredPosts && Array.isArray(finalFilteredPosts)) {
      for (const post of finalFilteredPosts) {
        if (post?.id) {
          postsById.set(post.id, post);
        }
      }
    }

    // Get all unique published post IDs (External Post IDs only)
    // finalFilteredAnalytics is already filtered to only published posts
    const allPostIds = new Set<string>();
    for (const analytics of finalFilteredAnalytics) {
      // Only include published posts (already filtered, but double-check)
      if (analytics.post_id) {
        const metadata = (analytics.metadata as any) || {};
        const isExternal = metadata.isExternal !== undefined ? metadata.isExternal : true;
        const status = metadata.platformStatus || metadata.status;

        // Only add if published (External Post)
        if (isExternal || status === 'published') {
          allPostIds.add(analytics.post_id);
        }
      }
    }
    // Also add published posts from posts table
    if (finalFilteredPosts && Array.isArray(finalFilteredPosts)) {
      for (const post of finalFilteredPosts) {
        // Only include published posts
        if (post?.id && post.status === 'published') {
          allPostIds.add(post.id);
        }
      }
    }

    // First, collect all posts with their metrics for smart score calculation
    const postsForScoring = Array.from(allPostIds).map((postId) => {
      const p = postsById.get(postId);
      const analytics = latestAnalyticsByPost.get(postId);
      const postData = p || {
        id: postId,
        content: (analytics?.metadata as any)?.content || 'Post from Getlate',
        created_at: analytics?.date || new Date().toISOString(),
        image_url: (analytics?.metadata as any)?.thumbnailUrl || null,
        metadata: analytics?.metadata || {},
        platforms: analytics?.platform ? [{ platform: analytics.platform }] : null,
      };

      const postAnalytics = latestAnalyticsByPost.get(postId);
      const impressions = postAnalytics ? Number(postAnalytics.impressions ?? 0) : 0;
      const likes = postAnalytics ? Number(postAnalytics.likes ?? 0) : 0;
      const comments = postAnalytics ? Number(postAnalytics.comments ?? 0) : 0;
      const shares = postAnalytics ? Number(postAnalytics.shares ?? 0) : 0;
      const metadata = postAnalytics ? ((postAnalytics.metadata as any) || {}) : {};
      const engagement = likes + comments + shares;
      const engagementRateFromMetadata = metadata.engagementRate !== undefined ? Number(metadata.engagementRate) : null;
      const engagementRate = engagementRateFromMetadata !== null
        ? engagementRateFromMetadata
        : (impressions > 0 ? (engagement / impressions) * 100 : 0);

      // Get platform
      let platform = 'unknown';
      const platformsFromAnalytics = postPlatformMap.get(postId);
      if (platformsFromAnalytics && platformsFromAnalytics.size > 0) {
        const platformsArray = Array.from(platformsFromAnalytics);
        platform = platformsArray[0] || 'unknown';
      } else {
        const platformsFromScheduled = postPlatformMapFromScheduled.get(postId);
        if (platformsFromScheduled && platformsFromScheduled.size > 0) {
          const platformsArray = Array.from(platformsFromScheduled);
          platform = platformsArray[0] || 'unknown';
        } else {
          const postPlatforms = (postData as any)?.platforms;
          if (postPlatforms && Array.isArray(postPlatforms) && postPlatforms.length > 0) {
            const firstPlatform = postPlatforms[0];
            if (typeof firstPlatform === 'string') {
              platform = normalizePlatform(firstPlatform);
            } else if (firstPlatform?.platform) {
              platform = normalizePlatform(firstPlatform.platform);
            }
          }
          if (platform === 'unknown') {
            const meta = (postData as any)?.metadata as any;
            platform = normalizePlatform(meta?.platform ?? (postAnalytics?.platform || 'unknown'));
          }
        }
      }

      // Extract media URLs
      const meta = (postData as any)?.metadata as any;
      const rawMediaUrls = meta?.media_urls && Array.isArray(meta.media_urls) ? meta.media_urls : [];
      const mediaUrls = rawMediaUrls
        .filter((url: any): url is string => Boolean(url && typeof url === 'string'))
        .map((url: string) => String(url).trim())
        .filter((url: string) => url.length > 0);
      const rawImageUrl = (postData as any)?.image_url;
      const imageUrl = rawImageUrl && typeof rawImageUrl === 'string' ? String(rawImageUrl).trim() : null;
      const finalMediaUrls = mediaUrls.length > 0
        ? mediaUrls
        : (imageUrl && imageUrl.length > 0 ? [imageUrl] : []);

      return {
        id: postId,
        platform,
        metadata: meta,
        mediaUrls: finalMediaUrls,
        metrics: {
          impressions,
          engagement,
          engagementRate,
        },
      };
    });

    // Calculate smart scores for all posts (relative to brand's top 10 posts of same type)
    const smartScores = calculateScoresForPosts(postsForScoring);

    // Generate table data for all posts (only published posts with External Post IDs)
    // Filter to only include posts that have analytics (published posts)
    const publishedPostIds = Array.from(allPostIds).filter((postId) => {
      const analytics = latestAnalyticsByPost.get(postId);
      if (!analytics) {
        // If no analytics, check if post is published
        const post = postsById.get(postId);
        return post && post.status === 'published';
      }

      // Verify analytics is from published post (External Post ID)
      const metadata = (analytics.metadata as any) || {};
      const isExternal = metadata.isExternal !== undefined ? metadata.isExternal : true;
      const status = metadata.platformStatus || metadata.status;

      // Only include if published
      return isExternal || status === 'published';
    });

    // Expand posts to one row per platform (only published platforms)
    const expandedPostsFromDb: typeof postsTableData = [];

    for (const postId of publishedPostIds) {
      // Get post from posts table if it exists, otherwise create from analytics
      const p = postsById.get(postId);
      const analytics = latestAnalyticsByPost.get(postId);

      // If post doesn't exist in posts table, create a minimal post object from analytics
      const postData = p || {
        id: postId,
        content: (analytics?.metadata as any)?.content || 'Post from Getlate',
        created_at: analytics?.date || new Date().toISOString(),
        image_url: (analytics?.metadata as any)?.thumbnailUrl || null,
        metadata: analytics?.metadata || {},
        platforms: analytics?.platform ? [{ platform: analytics.platform }] : null,
      };

      // Extract media URLs (shared across all platforms)
      const meta = (postData as any)?.metadata as any;
      const rawMediaUrls = meta?.media_urls && Array.isArray(meta.media_urls) ? meta.media_urls : [];
      const mediaUrls = rawMediaUrls
        .filter((url: any): url is string => Boolean(url && typeof url === 'string'))
        .map((url: string) => String(url).trim())
        .filter((url: string) => url.length > 0);
      const rawImageUrl = (postData as any)?.image_url;
      const imageUrl = rawImageUrl && typeof rawImageUrl === 'string' ? String(rawImageUrl).trim() : null;

      const normalizedMediaUrls = mediaUrls
        .filter((url: any): url is string => Boolean(url && typeof url === 'string'))
        .map((url: string) => String(url).trim())
        .filter((url: string) => url.length > 0)
        .sort((a: string, b: string) => {
          try {
            const urlA = new URL(a);
            const urlB = new URL(b);
            const normalizedA = `${urlA.origin}${urlA.pathname}`;
            const normalizedB = `${urlB.origin}${urlB.pathname}`;
            return normalizedA.localeCompare(normalizedB);
          } catch {
            return a.localeCompare(b);
          }
        });

      const normalizedImageUrl = imageUrl && typeof imageUrl === 'string' ? String(imageUrl).trim() : null;
      const finalMediaUrls = normalizedMediaUrls.length > 0
        ? normalizedMediaUrls
        : (normalizedImageUrl && normalizedImageUrl.length > 0 ? [normalizedImageUrl] : []);

      // Get base score (same for all platforms of this post)
      const baseScore = smartScores.get(postId) || 0;

      // Determine which platforms this post was published on
      // Priority: Analytics platforms > Scheduled platforms > Post platforms array > Single platform
      const platformsSet = new Set<string>();

      // Priority 1: Analytics platforms (most reliable - from post_analytics table)
      const platformsFromAnalytics = postPlatformMap.get(postId);
      if (platformsFromAnalytics && platformsFromAnalytics.size > 0) {
        platformsFromAnalytics.forEach((plat) => {
          if (plat !== 'unknown') {
            platformsSet.add(plat);
          }
        });
      }

      // Priority 2: Scheduled posts -> social accounts
      if (platformsSet.size === 0) {
        const platformsFromScheduled = postPlatformMapFromScheduled.get(postId);
        if (platformsFromScheduled && platformsFromScheduled.size > 0) {
          platformsFromScheduled.forEach((plat) => {
            if (plat !== 'unknown') {
              platformsSet.add(plat);
            }
          });
        }
      }

      // Priority 3: Post platforms array (from Getlate)
      if (platformsSet.size === 0) {
        const postPlatforms = (postData as any)?.platforms;
        if (postPlatforms && Array.isArray(postPlatforms) && postPlatforms.length > 0) {
          postPlatforms.forEach((platformData: any) => {
            let platformName = 'unknown';
            if (typeof platformData === 'string') {
              platformName = normalizePlatform(platformData);
            } else if (platformData?.platform) {
              platformName = normalizePlatform(platformData.platform);
            }
            if (platformName !== 'unknown') {
              platformsSet.add(platformName);
            }
          });
        }
      }

      // Priority 4: Single platform fallback
      if (platformsSet.size === 0) {
        const postAnalytics = latestAnalyticsByPost.get(postId);
        const meta = (postData as any)?.metadata as any;
        const fallbackPlatform = normalizePlatform(meta?.platform ?? (postAnalytics?.platform || 'unknown'));
        if (fallbackPlatform !== 'unknown') {
          platformsSet.add(fallbackPlatform);
        }
      }

      // If still no platforms, skip this post
      if (platformsSet.size === 0) {
        continue;
      }

      // Get all analytics entries for this post to find platform-specific data
      const allPostAnalytics = allAnalyticsByPost.get(postId) || [];

      // Create one row per platform
      for (const platformName of platformsSet) {
        const platform = normalizePlatform(platformName);

        // Find platform-specific analytics if available
        // Look for analytics entry that matches this platform
        let platformAnalytics = latestAnalyticsByPost.get(postId);
        let platformPostUrl: string | null = null;

        // Search for platform-specific analytics and URL
        for (const analyticsEntry of allPostAnalytics) {
          const analyticsPlatform = normalizePlatform(analyticsEntry?.platform || 'unknown');
          if (analyticsPlatform === platform) {
            platformAnalytics = analyticsEntry;
            const analyticsMetadata = analyticsEntry?.metadata as any;
            if (analyticsMetadata?.platformPostUrl) {
              platformPostUrl = analyticsMetadata.platformPostUrl;
              break; // Found platform-specific data
            }
          }
        }

        // If no platform-specific analytics found, use latest analytics
        if (!platformAnalytics) {
          platformAnalytics = latestAnalyticsByPost.get(postId);
        }

        // If still no platform-specific URL, check post platforms array
        if (!platformPostUrl) {
          const postPlatforms = (postData as any)?.platforms;
          if (postPlatforms && Array.isArray(postPlatforms) && postPlatforms.length > 0) {
            for (const platformData of postPlatforms) {
              const platformObj = typeof platformData === 'object' ? platformData : null;
              const platformDataName = platformObj?.platform
                ? normalizePlatform(platformObj.platform)
                : (typeof platformData === 'string' ? normalizePlatform(platformData) : 'unknown');

              if (platformDataName === platform && platformObj?.platformPostUrl) {
                platformPostUrl = platformObj.platformPostUrl;
                break;
              }
            }
            // If still not found, try first platform's URL
            if (!platformPostUrl) {
              const firstPlatform = postPlatforms[0];
              const firstPlatformObj = typeof firstPlatform === 'object' ? firstPlatform : null;
              if (firstPlatformObj?.platformPostUrl) {
                platformPostUrl = firstPlatformObj.platformPostUrl;
              }
            }
          }
        }

        // Extract metrics from platform-specific analytics or fallback to latest
        const impressions = platformAnalytics ? Number(platformAnalytics.impressions ?? 0) : 0;
        const likes = platformAnalytics ? Number(platformAnalytics.likes ?? 0) : 0;
        const comments = platformAnalytics ? Number(platformAnalytics.comments ?? 0) : 0;
        const shares = platformAnalytics ? Number(platformAnalytics.shares ?? 0) : 0;
        const analyticsMetadata = platformAnalytics ? ((platformAnalytics.metadata as any) || {}) : {};
        const reach = Number(analyticsMetadata.reach ?? 0);
        const clicks = Number(analyticsMetadata.clicks ?? 0);
        const views = Number(analyticsMetadata.views ?? 0);
        const engagement = likes + comments + shares;
        const engagementRateFromMetadata = analyticsMetadata.engagementRate !== undefined ? Number(analyticsMetadata.engagementRate) : null;
        const engagementRate = engagementRateFromMetadata !== null
          ? engagementRateFromMetadata
          : (impressions > 0 ? (engagement / impressions) * 100 : 0);

        expandedPostsFromDb.push({
          id: `${postId}-${platform}`, // Unique ID per platform
          score: baseScore,
          engagementRate,
          engagement,
          likes,
          comments,
          shares,
          impressions,
          reach,
          clicks,
          views,
          date: platformAnalytics?.date ?? (postData as any)?.created_at ?? new Date().toISOString(),
          postContent: (postData as any)?.content ?? '',
          platform,
          mediaUrls: finalMediaUrls,
          imageUrl: imageUrl && imageUrl.length > 0 ? imageUrl : undefined,
          platformPostUrl, // Platform-specific URL
        });
      }
    }

    // Filter expandedPostsFromDb by platform if selectedPlatform is set
    // This ensures postsTableData matches the platform filter from URL params
    let filteredExpandedPostsFromDb = expandedPostsFromDb;
    if (selectedPlatform && selectedPlatform !== 'all') {
      const normalizedSelectedPlatform = normalizePlatform(selectedPlatform);
      filteredExpandedPostsFromDb = expandedPostsFromDb.filter(row =>
        normalizePlatform(row.platform || '') === normalizedSelectedPlatform,
      );
    }

    postsTableData = filteredExpandedPostsFromDb;

    // Recalculate totalPosts based on platform-specific counts to match "All Platforms"
    // Count platform occurrences (rows in table) instead of unique post IDs
    // This ensures "Total Posts" matches the sum of platform cards
    if (selectedPlatform && selectedPlatform !== 'all') {
      // When platform is selected, use that platform's count
      const normalizedSelectedPlatform = normalizePlatform(selectedPlatform);
      totalPosts = platformPostsCount.get(normalizedSelectedPlatform) || 0;
    } else {
      // When "all" is selected, sum all platform-specific counts
      const sumOfPlatformPosts = Array.from(platformPostsCount.values()).reduce((sum, count) => sum + count, 0);
      totalPosts = sumOfPlatformPosts > 0 ? sumOfPlatformPosts : filteredExpandedPostsFromDb.length;
    }
  } else {
    // If no posts data at all, ensure totalPosts is 0
    if (!postsTableData || postsTableData.length === 0) {
      totalPosts = 0;
    }
  }
  // If no posts, postsTableData remains undefined and component shows empty state

  // Recalculate displayPosts, finalTotalPosts, and related changes after totalPosts has been updated from table data
  // This ensures the metric card shows the correct count that matches the table
  // Use totalPosts (recalculated from filtered table data) as the source of truth
  // This ensures consistency between metrics and table display
  const recalculatedDisplayPosts = totalPosts; // Always use totalPosts which is recalculated from filtered table data
  const recalculatedFinalTotalPosts = recalculatedDisplayPosts;

  return (
    <DashboardWrapper>
      <div className="min-h-screen w-full overflow-x-hidden bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="w-full space-y-8 overflow-x-hidden px-6">
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
            posts={formatted(recalculatedFinalTotalPosts)}
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
              <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
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
              <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
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
          {/* Pass selectedPlatform to sync PostsTable filter with dashboard filter */}
          <PostsTable posts={postsTableData} initialPlatformFilter={selectedPlatform} />
        </div>
      </div>
    </DashboardWrapper>
  );
}
