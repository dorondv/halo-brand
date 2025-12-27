import type { NextRequest } from 'next/server';
import { Buffer } from 'node:buffer';
import jsPDF from 'jspdf';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCachedAccounts, getCachedPosts } from '@/libs/dashboard-cache';
import { getFollowerStatsFromGetlate } from '@/libs/follower-stats-sync';
import { getGetlatePosts } from '@/libs/getlate-posts';
import { createSupabaseServerClient } from '@/libs/Supabase';

const exportRequestSchema = z.object({
  reportType: z.enum(['comprehensive', 'engagement', 'growth', 'posts']),
  exportFormat: z.enum(['pdf', 'excel', 'csv']),
  selectedPlatforms: z.array(z.string()),
  reportName: z.string().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
  brandId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = exportRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.issues },
        { status: 400 },
      );
    }

    const { reportType, exportFormat, selectedPlatforms, reportName, dateFrom, dateTo, brandId } = validated.data;

    if (selectedPlatforms.length === 0) {
      return NextResponse.json(
        { error: 'At least one platform must be selected' },
        { status: 400 },
      );
    }

    // Get user ID and Getlate API key from users table
    const { data: userRecord } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('email', user.email)
      .maybeSingle();

    const userId = userRecord?.id || user.id;
    const getlateApiKey = userRecord?.getlate_api_key;

    // Fetch data for the report
    const dateFromDate = new Date(dateFrom);
    const dateToDate = new Date(dateTo);
    dateToDate.setHours(23, 59, 59, 999); // Include full end date

    // Try to get data from Getlate API first (more comprehensive)
    // Fall back to local database if Getlate is not available
    let posts: any[] = [];
    let analytics: any[] = [];
    let followerStats: any = null;

    let useGetlate = false;
    if (getlateApiKey && brandId) {
      const { data: brandRecord } = await supabase
        .from('brands')
        .select('getlate_profile_id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (brandRecord?.getlate_profile_id) {
        useGetlate = true;
      }
    }

    if (useGetlate) {
      // Fetch posts from Getlate API (real data)
      const getlatePosts = await getGetlatePosts(supabase, userId, brandId ?? null, {
        fromDate: dateFrom,
        toDate: dateTo,
        platform: 'all' as any,
      });

      // Convert Getlate posts format to our format
      posts = getlatePosts.map(post => ({
        id: post._id || '',
        content: post.content || '',
        created_at: post.publishedAt || new Date().toISOString(),
        platforms: [post.platform],
        image_url: post.thumbnailUrl || (Array.isArray(post.mediaItems) && post.mediaItems.length > 0 ? (post.mediaItems[0] as { url?: string })?.url : null) || null,
        metadata: post,
      }));

      // Extract analytics from Getlate posts (they include analytics in the response)
      // Getlate API returns analytics directly in the post object
      analytics = getlatePosts
        .filter(post => post.analytics)
        .map((post) => {
          const postAnalytics = post.analytics || {};

          return {
            post_id: post._id || '',
            platform: post.platform,
            date: post.publishedAt
              ? new Date(post.publishedAt).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
            likes: postAnalytics.likes || 0,
            comments: postAnalytics.comments || 0,
            shares: postAnalytics.shares || 0,
            impressions: postAnalytics.impressions || postAnalytics.reach || 0,
            reach: postAnalytics.reach || postAnalytics.impressions || 0,
            clicks: postAnalytics.clicks || 0,
            views: postAnalytics.views || 0,
            metadata: {
              ...postAnalytics,
              reach: postAnalytics.reach || postAnalytics.impressions || 0,
              clicks: postAnalytics.clicks || 0,
              views: postAnalytics.views || 0,
            },
          };
        });

      // Fetch follower stats for growth report
      if (reportType === 'growth') {
        followerStats = await getFollowerStatsFromGetlate(supabase, userId, brandId ?? null, {
          fromDate: dateFromDate,
          toDate: dateToDate,
          granularity: 'daily',
        });
      }
    } else {
      // Fall back to local database
      const cachedData = await getCachedPosts(
        supabase,
        userId,
        brandId || null,
        dateFromDate,
        dateToDate,
      );
      posts = cachedData.posts;
      analytics = cachedData.analytics;
    }

    const accounts = await getCachedAccounts(supabase, userId, brandId || null);

    // Normalize platform names for comparison (handle twitter/x, case-insensitive)
    const normalizePlatform = (platform: string): string => {
      const normalized = platform.toLowerCase().trim();
      // Normalize twitter/x to 'x' for consistency
      if (normalized === 'twitter' || normalized === 'x') {
        return 'x';
      }
      return normalized;
    };

    // Normalize selected platforms
    const normalizedSelectedPlatforms = selectedPlatforms.map(normalizePlatform);

    // Filter posts by selected platforms (case-insensitive, handles twitter/x)
    const filteredPosts = posts.filter((post) => {
      const postPlatforms = (post.platforms as string[]) || [];
      return postPlatforms.some((platform) => {
        const normalizedPlatform = normalizePlatform(platform);
        return normalizedSelectedPlatforms.includes(normalizedPlatform);
      });
    });

    // Filter analytics by selected platforms (case-insensitive, handles twitter/x)
    const filteredAnalytics = analytics.filter((analyticsItem) => {
      const normalizedPlatform = normalizePlatform(analyticsItem.platform || '');
      return normalizedSelectedPlatforms.includes(normalizedPlatform);
    });

    // Filter follower stats by selected platforms for growth reports
    if (followerStats && reportType === 'growth') {
      // Filter accounts array by selected platforms
      if (followerStats.accounts && Array.isArray(followerStats.accounts)) {
        followerStats.accounts = followerStats.accounts.filter((account: any) => {
          const platformName = account.platform || '';
          const normalizedPlatform = normalizePlatform(platformName);
          return normalizedSelectedPlatforms.includes(normalizedPlatform);
        });
      }

      // If we have stats object with account IDs as keys, filter those too
      if (followerStats.stats && typeof followerStats.stats === 'object') {
        // Get account IDs that match selected platforms
        const matchingAccountIds: string[] = [];
        if (followerStats.accounts && Array.isArray(followerStats.accounts)) {
          for (const account of followerStats.accounts) {
            const platformName = account.platform || '';
            const normalizedPlatform = normalizePlatform(platformName);
            if (normalizedSelectedPlatforms.includes(normalizedPlatform) && account._id) {
              matchingAccountIds.push(account._id);
            }
          }
        }

        // Filter stats object to only include matching account IDs
        const filteredStats: Record<string, any> = {};
        for (const accountId of matchingAccountIds) {
          if (followerStats.stats[accountId]) {
            filteredStats[accountId] = followerStats.stats[accountId];
          }
        }
        followerStats.stats = filteredStats;
      }
    }

    // Generate report data based on report type
    const reportData = generateReportData(reportType, filteredPosts, filteredAnalytics, accounts, dateFrom, dateTo, followerStats);

    // Generate file based on format
    let fileContent: string | Buffer;
    let mimeType: string;
    let fileName: string;

    const defaultFileName = reportName || `report-${dateFrom}-${dateTo}`;

    switch (exportFormat) {
      case 'csv':
        fileContent = generateCSV(reportData, reportType);
        mimeType = 'text/csv';
        fileName = `${defaultFileName}.csv`;
        break;
      case 'excel':
        // For now, generate CSV format (Excel can open CSV files)
        // TODO: Implement proper Excel generation with xlsx library
        fileContent = generateCSV(reportData, reportType);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = `${defaultFileName}.xlsx`;
        break;
      case 'pdf':
        fileContent = generatePDF(reportData, reportType, reportName || 'Report', dateFrom, dateTo);
        mimeType = 'application/pdf';
        fileName = `${defaultFileName}.pdf`;
        break;
      default:
        return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
    }

    // Return file as response
    // Ensure Buffer is used for binary data (PDF, Excel)
    const responseBody: string | Buffer = typeof fileContent === 'string' ? fileContent : Buffer.from(fileContent);

    return new NextResponse(responseBody as BodyInit, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileContent.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Reports Export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

type ReportData = {
  headers: string[];
  rows: (string | number)[][];
  summary?: Record<string, string | number>;
};

function generateReportData(
  reportType: string,
  posts: any[],
  analytics: any[],
  accounts: any[],
  dateFrom: string,
  dateTo: string,
  followerStats?: any,
): ReportData {
  switch (reportType) {
    case 'comprehensive':
      return generateComprehensiveReport(posts, analytics, accounts, dateFrom, dateTo);
    case 'engagement':
      return generateEngagementReport(posts, analytics, dateFrom, dateTo);
    case 'growth':
      return generateGrowthReport(analytics, accounts, dateFrom, dateTo, followerStats);
    case 'posts':
      return generatePostsReport(posts, analytics, dateFrom, dateTo);
    default:
      return { headers: [], rows: [] };
  }
}

function generateComprehensiveReport(
  posts: any[],
  analytics: any[],
  _accounts: any[],
  _dateFrom: string,
  _dateTo: string,
): ReportData {
  const headers = [
    'Date',
    'Platform',
    'Post ID',
    'Content',
    'Likes',
    'Comments',
    'Shares',
    'Impressions',
    'Engagement Rate',
  ];

  // Aggregate analytics by post
  const analyticsByPost = new Map<string, any>();
  for (const analytic of analytics) {
    const existing = analyticsByPost.get(analytic.post_id) || {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
    };
    analyticsByPost.set(analytic.post_id, {
      likes: existing.likes + (analytic.likes || 0),
      comments: existing.comments + (analytic.comments || 0),
      shares: existing.shares + (analytic.shares || 0),
      impressions: existing.impressions + (analytic.impressions || 0),
    });
  }

  const rows: (string | number)[][] = [];
  for (const post of posts) {
    const postAnalytics = analyticsByPost.get(post.id) || {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
    };
    const totalEngagement = postAnalytics.likes + postAnalytics.comments + postAnalytics.shares;
    const engagementRate = postAnalytics.impressions > 0
      ? ((totalEngagement / postAnalytics.impressions) * 100).toFixed(2)
      : '0.00';

    const platforms = (post.platforms as string[]) || [];
    // Use published date from scheduled_posts if available, otherwise created_at
    const publishDate = post.metadata?.publishedAt
      ? new Date(post.metadata.publishedAt).toLocaleDateString()
      : new Date(post.created_at).toLocaleDateString();

    for (const platform of platforms) {
      rows.push([
        publishDate,
        platform,
        post.id.substring(0, 8),
        (post.content || '').substring(0, 100),
        postAnalytics.likes,
        postAnalytics.comments,
        postAnalytics.shares,
        postAnalytics.impressions,
        engagementRate,
      ]);
    }
  }

  // Calculate summary
  const totalLikes = analytics.reduce((sum, a) => sum + (a.likes || 0), 0);
  const totalComments = analytics.reduce((sum, a) => sum + (a.comments || 0), 0);
  const totalShares = analytics.reduce((sum, a) => sum + (a.shares || 0), 0);
  const totalImpressions = analytics.reduce((sum, a) => sum + (a.impressions || 0), 0);
  const totalEngagement = totalLikes + totalComments + totalShares;
  const avgEngagementRate = totalImpressions > 0 ? ((totalEngagement / totalImpressions) * 100).toFixed(2) : '0.00';

  return {
    headers,
    rows,
    summary: {
      'Total Posts': posts.length,
      'Total Likes': totalLikes,
      'Total Comments': totalComments,
      'Total Shares': totalShares,
      'Total Impressions': totalImpressions,
      'Average Engagement Rate': `${avgEngagementRate}%`,
    },
  };
}

function generateEngagementReport(_posts: any[], analytics: any[], _dateFrom: string, _dateTo: string): ReportData {
  const headers = ['Date', 'Platform', 'Likes', 'Comments', 'Shares', 'Total Engagement', 'Engagement Rate %'];

  // Group analytics by date and platform
  const dailyData = new Map<string, { likes: number; comments: number; shares: number; impressions: number }>();

  for (const analytic of analytics) {
    // Use the date from analytics, or fall back to post date
    const date = analytic.date || new Date().toISOString().split('T')[0];
    const platform = analytic.platform || 'unknown';
    const key = `${date}_${platform}`;

    const existing = dailyData.get(key) || { likes: 0, comments: 0, shares: 0, impressions: 0 };
    dailyData.set(key, {
      likes: existing.likes + (analytic.likes || 0),
      comments: existing.comments + (analytic.comments || 0),
      shares: existing.shares + (analytic.shares || 0),
      impressions: existing.impressions + (analytic.impressions || 0),
    });
  }

  const rows: (string | number)[][] = [];

  // Sort by date (ascending) for better readability
  const sortedEntries = Array.from(dailyData.entries()).sort((a, b) => {
    const dateA = a[0].split('_')[0];
    const dateB = b[0].split('_')[0];
    if (!dateA || !dateB) {
      return 0;
    }
    return dateA.localeCompare(dateB);
  });

  for (const [key, data] of sortedEntries) {
    const parts = key.split('_');
    const date = parts[0];
    const platform = parts[1];
    if (!date || !platform) {
      continue;
    }
    const totalEngagement = data.likes + data.comments + data.shares;
    const engagementRate = data.impressions > 0
      ? ((totalEngagement / data.impressions) * 100).toFixed(2)
      : '0.00';

    rows.push([
      date,
      platform,
      data.likes,
      data.comments,
      data.shares,
      totalEngagement,
      `${engagementRate}%`,
    ]);
  }

  // Add summary if we have data
  if (rows.length > 0) {
    const totalLikes = Array.from(dailyData.values()).reduce((sum, d) => sum + d.likes, 0);
    const totalComments = Array.from(dailyData.values()).reduce((sum, d) => sum + d.comments, 0);
    const totalShares = Array.from(dailyData.values()).reduce((sum, d) => sum + d.shares, 0);
    const totalImpressions = Array.from(dailyData.values()).reduce((sum, d) => sum + d.impressions, 0);
    const totalEngagement = totalLikes + totalComments + totalShares;
    const avgEngagementRate = totalImpressions > 0
      ? ((totalEngagement / totalImpressions) * 100).toFixed(2)
      : '0.00';

    return {
      headers,
      rows,
      summary: {
        'Total Likes': totalLikes,
        'Total Comments': totalComments,
        'Total Shares': totalShares,
        'Total Engagement': totalEngagement,
        'Average Engagement Rate': `${avgEngagementRate}%`,
      },
    };
  }

  return { headers, rows };
}

function generateGrowthReport(
  _analytics: any[],
  _accounts: any[],
  _dateFrom: string,
  _dateTo: string,
  followerStats?: any,
): ReportData {
  const headers = ['Date', 'Platform', 'Followers', 'Growth', 'Growth Rate %'];

  const rows: (string | number)[][] = [];

  // Normalize platform names for comparison
  const normalizePlatform = (platform: string): string => {
    const normalized = platform.toLowerCase().trim();
    if (normalized === 'twitter' || normalized === 'x') {
      return 'x';
    }
    return normalized;
  };

  if (followerStats && followerStats.accounts && Array.isArray(followerStats.accounts) && followerStats.accounts.length > 0) {
    // Use account-level follower stats (more accurate, includes platform info)
    // Group by platform and date if we have detailed stats
    const platformStats = new Map<string, Array<{ date: string; followers: number; growth: number }>>();

    // Process each account's stats
    for (const account of followerStats.accounts) {
      const platform = normalizePlatform(account.platform || 'unknown');

      // If we have detailed stats per platform, use them
      if (followerStats.stats && followerStats.stats[account._id]) {
        const accountStats = followerStats.stats[account._id];
        if (Array.isArray(accountStats)) {
          const platformData: Array<{ date: string; followers: number; growth: number }> = [];
          let previousFollowers = account.currentFollowers || 0;

          // Sort by date ascending
          const sortedStats = [...accountStats].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
          );

          for (const stat of sortedStats) {
            const followers = stat.followers || 0;
            const growth = followers - previousFollowers;
            platformData.push({
              date: stat.date,
              followers,
              growth,
            });
            previousFollowers = followers;
          }

          platformStats.set(platform, platformData);
        }
      } else {
        // Fallback: use account summary data
        const existing = platformStats.get(platform) || [];
        existing.push({
          date: _dateTo,
          followers: account.currentFollowers || 0,
          growth: account.growth || 0,
        });
        platformStats.set(platform, existing);
      }
    }

    // Convert to rows
    for (const [platform, stats] of platformStats.entries()) {
      for (const stat of stats) {
        const growthRate = stat.followers > 0 && stat.followers - stat.growth > 0
          ? ((stat.growth / (stat.followers - stat.growth)) * 100).toFixed(2)
          : '0.00';

        rows.push([
          stat.date,
          platform,
          stat.followers,
          stat.growth >= 0 ? `+${stat.growth}` : `${stat.growth}`,
          `${growthRate}%`,
        ]);
      }
    }
  } else if (followerStats && followerStats.followerTrend && followerStats.followerTrend.length > 0) {
    // Use aggregated follower stats (less detailed, but better than nothing)
    const followerData = followerStats.followerTrend;
    const netGrowthData = followerStats.netGrowth || [];

    // Group by date and calculate growth
    const growthByDate = new Map<string, { followers: number; growth: number }>();

    for (const dataPoint of followerData) {
      const date = dataPoint.date;
      growthByDate.set(date, {
        followers: dataPoint.followers || 0,
        growth: 0,
      });
    }

    // Add growth data
    for (const growthPoint of netGrowthData) {
      const date = growthPoint.date;
      const existing = growthByDate.get(date);
      if (existing) {
        existing.growth = growthPoint.growth || 0;
      }
    }

    // Calculate growth rate and convert to rows
    // Group by platform if we have account info
    if (followerStats.accounts && Array.isArray(followerStats.accounts)) {
      // Use account-level data if available
      for (const account of followerStats.accounts) {
        const platform = normalizePlatform(account.platform || 'all');
        let previousFollowers = account.currentFollowers || 0;

        for (const [date, data] of Array.from(growthByDate.entries()).sort()) {
          // Distribute followers proportionally or use account data
          const accountFollowers = account.currentFollowers || 0;
          const totalFollowers = Array.from(growthByDate.values()).reduce((sum, d) => sum + d.followers, 0);
          const estimatedFollowers = totalFollowers > 0
            ? Math.round((data.followers / totalFollowers) * accountFollowers)
            : data.followers;

          const growthRate = previousFollowers > 0
            ? (((estimatedFollowers - previousFollowers) / previousFollowers) * 100).toFixed(2)
            : '0.00';

          rows.push([
            date,
            platform,
            estimatedFollowers,
            (estimatedFollowers - previousFollowers) >= 0
              ? `+${estimatedFollowers - previousFollowers}`
              : `${estimatedFollowers - previousFollowers}`,
            `${growthRate}%`,
          ]);

          previousFollowers = estimatedFollowers;
        }
      }
    } else {
      // Fallback: aggregate all platforms
      let previousFollowers = 0;
      for (const [date, data] of Array.from(growthByDate.entries()).sort()) {
        const growthRate = previousFollowers > 0
          ? ((data.growth / previousFollowers) * 100).toFixed(2)
          : '0.00';

        rows.push([
          date,
          'all',
          data.followers,
          data.growth >= 0 ? `+${data.growth}` : `${data.growth}`,
          `${growthRate}%`,
        ]);

        previousFollowers = data.followers;
      }
    }
  } else {
    // Fallback: use analytics data to estimate (less accurate)
    const platformData = new Map<string, { date: string; platform: string; posts: number }>();

    for (const analytic of _analytics) {
      const key = `${analytic.date}_${analytic.platform}`;
      const existing = platformData.get(key);
      if (!existing) {
        platformData.set(key, {
          date: analytic.date,
          platform: analytic.platform,
          posts: 1,
        });
      } else {
        existing.posts += 1;
      }
    }

    // Convert to rows (estimated based on post activity)
    for (const [, data] of platformData.entries()) {
      rows.push([
        data.date,
        data.platform,
        'N/A', // Follower count not available
        'N/A',
        'N/A',
      ]);
    }
  }

  return { headers, rows };
}

function generatePostsReport(posts: any[], analytics: any[], _dateFrom: string, _dateTo: string): ReportData {
  const headers = [
    'Date',
    'Platform',
    'Post ID',
    'Content',
    'Likes',
    'Comments',
    'Shares',
    'Impressions',
    'Reach',
    'Clicks',
    'Views',
  ];

  // Aggregate analytics by post
  const analyticsByPost = new Map<string, any>();
  for (const analytic of analytics) {
    const existing = analyticsByPost.get(analytic.post_id) || {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      views: 0,
    };
    const metadata = (analytic.metadata as any) || {};
    analyticsByPost.set(analytic.post_id, {
      likes: existing.likes + (analytic.likes || 0),
      comments: existing.comments + (analytic.comments || 0),
      shares: existing.shares + (analytic.shares || 0),
      impressions: existing.impressions + (analytic.impressions || 0),
      reach: existing.reach + (metadata.reach || 0),
      clicks: existing.clicks + (metadata.clicks || 0),
      views: existing.views + (metadata.views || 0),
    });
  }

  const rows: (string | number)[][] = [];
  for (const post of posts) {
    const postAnalytics = analyticsByPost.get(post.id) || {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      views: 0,
    };

    const platforms = (post.platforms as string[]) || [];
    // Use published date from scheduled_posts if available, otherwise created_at
    const publishDate = post.metadata?.publishedAt
      ? new Date(post.metadata.publishedAt).toLocaleDateString()
      : new Date(post.created_at).toLocaleDateString();

    for (const platform of platforms) {
      rows.push([
        publishDate,
        platform,
        post.id.substring(0, 8),
        (post.content || '').substring(0, 200),
        postAnalytics.likes,
        postAnalytics.comments,
        postAnalytics.shares,
        postAnalytics.impressions,
        postAnalytics.reach,
        postAnalytics.clicks,
        postAnalytics.views,
      ]);
    }
  }

  return { headers, rows };
}

function generateCSV(data: ReportData, _reportType: string): string {
  const lines: string[] = [];

  // Add summary if available
  if (data.summary) {
    lines.push('Summary');
    for (const [key, value] of Object.entries(data.summary)) {
      lines.push(`${key},${value}`);
    }
    lines.push(''); // Empty line
  }

  // Add headers
  lines.push(data.headers.join(','));

  // Add rows
  for (const row of data.rows) {
    // Escape commas and quotes in CSV
    const escapedRow = row.map((cell) => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(escapedRow.join(','));
  }

  // Add BOM for Excel compatibility with Hebrew
  return `\uFEFF${lines.join('\n')}`;
}

function generatePDF(
  data: ReportData,
  reportType: string,
  reportName: string,
  dateFrom: string,
  dateTo: string,
): Buffer {
  // eslint-disable-next-line new-cap
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15; // Reduced margin for more space
  const topMargin = 30; // Extra space for header
  let yPosition = topMargin;
  const lineHeight = 6.5; // Slightly reduced line height
  const maxWidth = pageWidth - (margin * 2);
  const smallFontSize = 7; // Slightly smaller font to fit more content
  const headerFontSize = 8; // Slightly larger for headers
  const normalFontSize = 9;
  const titleFontSize = 18;

  // Color scheme
  const colors = {
    primary: [236, 72, 153], // Pink brand color
    primaryLight: [249, 168, 212], // Light pink
    headerBg: [249, 250, 251], // Light gray
    border: [229, 231, 235], // Gray border
    text: [17, 24, 39], // Dark gray text
    textLight: [107, 114, 128], // Light gray text
    rowEven: [255, 255, 255], // White
    rowOdd: [249, 250, 251], // Very light gray
  };

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin - 15) {
      doc.addPage();
      yPosition = topMargin;
      return true;
    }
    return false;
  };

  // Helper function to add text with word wrap and better formatting (unused but kept for potential future use)

  // @ts-expect-error - Unused function kept for potential future use
  const _addText = (text: string, fontSize: number, isBold = false, align: 'left' | 'center' | 'right' = 'left', maxW = maxWidth, color?: number[]) => {
    doc.setFontSize(fontSize);
    if (isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }

    if (color && color[0] !== undefined && color[1] !== undefined && color[2] !== undefined) {
      doc.setTextColor(color[0], color[1], color[2]);
    } else {
      doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
    }

    const lines = doc.splitTextToSize(String(text), maxW);
    lines.forEach((line: string) => {
      checkPageBreak(lineHeight);
      doc.text(line, align === 'center' ? pageWidth / 2 : align === 'right' ? pageWidth - margin : margin, yPosition, { align });
      yPosition += lineHeight;
    });

    // Reset text color
    doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
  };

  // Helper function to format numbers
  const formatNumber = (num: number | string): string => {
    if (typeof num === 'string') {
      return num;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Add header with brand color
  doc.setFillColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
  doc.rect(0, 0, pageWidth, 25, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Hello Brand', margin, 17, { align: 'left' });

  const currentDate = new Date().toLocaleDateString();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${currentDate}`, pageWidth - margin, 17, { align: 'right' });

  doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
  yPosition = topMargin + 5;

  // Title with better styling
  doc.setFontSize(titleFontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
  const titleLines = doc.splitTextToSize(reportName, maxWidth);
  titleLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += lineHeight * 1.2;
  });
  doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
  yPosition += lineHeight * 0.5;

  // Report metadata with better formatting
  doc.setFontSize(normalFontSize);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textLight[0]!, colors.textLight[1]!, colors.textLight[2]!);

  const periodText = `Period: ${dateFrom} to ${dateTo}`;
  doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += lineHeight;

  const typeText = `Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`;
  doc.text(typeText, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += lineHeight * 1.5;

  doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);

  // Add divider line
  doc.setDrawColor(colors.border[0]!, colors.border[1]!, colors.border[2]!);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += lineHeight * 1.5;

  // Summary section with better styling
  if (data.summary) {
    checkPageBreak(lineHeight * 5);

    // Summary title with background
    doc.setFillColor(colors.headerBg[0]!, colors.headerBg[1]!, colors.headerBg[2]!);
    doc.rect(margin, yPosition - lineHeight * 0.8, maxWidth, lineHeight * 1.8, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
    doc.text('Summary', margin + 5, yPosition + lineHeight * 0.3);
    doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
    yPosition += lineHeight * 1.5;

    // Create a two-column layout for summary with boxes
    const summaryEntries = Object.entries(data.summary);
    const midPoint = Math.ceil(summaryEntries.length / 2);

    const leftCol = summaryEntries.slice(0, midPoint);
    const rightCol = summaryEntries.slice(midPoint);

    const colWidth = (maxWidth - 15) / 2;
    const startY = yPosition;
    const boxHeight = lineHeight * 1.8;

    // Left column
    leftCol.forEach(([key, value]) => {
      checkPageBreak(boxHeight + 3);

      // Draw box background
      doc.setFillColor(colors.rowOdd[0]!, colors.rowOdd[1]!, colors.rowOdd[2]!);
      doc.roundedRect(margin, yPosition - lineHeight * 0.6, colWidth, boxHeight, 2, 2, 'F');

      // Draw border
      doc.setDrawColor(colors.border[0]!, colors.border[1]!, colors.border[2]!);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, yPosition - lineHeight * 0.6, colWidth, boxHeight, 2, 2, 'S');

      // Key (bold)
      doc.setFontSize(smallFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text(key, margin + 5, yPosition, { align: 'left' });

      // Value
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
      const valueText = typeof value === 'number' ? formatNumber(value) : String(value);
      doc.text(valueText, margin + 5, yPosition + lineHeight * 0.9, { align: 'left' });
      doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);

      yPosition += boxHeight + 3;
    });

    // Right column
    yPosition = startY;
    rightCol.forEach(([key, value]) => {
      checkPageBreak(boxHeight + 3);

      // Draw box background
      doc.setFillColor(colors.rowOdd[0]!, colors.rowOdd[1]!, colors.rowOdd[2]!);
      doc.roundedRect(margin + colWidth + 15, yPosition - lineHeight * 0.6, colWidth, boxHeight, 2, 2, 'F');

      // Draw border
      doc.setDrawColor(colors.border[0]!, colors.border[1]!, colors.border[2]!);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + colWidth + 15, yPosition - lineHeight * 0.6, colWidth, boxHeight, 2, 2, 'S');

      // Key (bold)
      doc.setFontSize(smallFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text(key, margin + colWidth + 20, yPosition, { align: 'left' });

      // Value
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
      const valueText = typeof value === 'number' ? formatNumber(value) : String(value);
      doc.text(valueText, margin + colWidth + 20, yPosition + lineHeight * 0.9, { align: 'left' });
      doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);

      yPosition += boxHeight + 3;
    });

    // Move to the maximum Y position
    yPosition = Math.max(
      startY + leftCol.length * (boxHeight + 3),
      startY + rightCol.length * (boxHeight + 3),
    );
    yPosition += lineHeight * 1.5;
  }

  // Data section with better styling
  checkPageBreak(lineHeight * 4);

  // Section title
  doc.setFillColor(colors.headerBg[0]!, colors.headerBg[1]!, colors.headerBg[2]!);
  doc.rect(margin, yPosition - lineHeight * 0.8, maxWidth, lineHeight * 1.8, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
  doc.text('Data', margin + 5, yPosition + lineHeight * 0.3);
  doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
  yPosition += lineHeight * 1.5;

  // Calculate optimal column widths based on content
  const numColumns = data.headers.length;

  // Define column width ratios (adjust based on typical content)
  const columnRatios: number[] = [];
  data.headers.forEach((header) => {
    const headerLower = header.toLowerCase();
    // Give more width to content column, less to IDs and rates
    if (headerLower.includes('content')) {
      columnRatios.push(3.5); // Content column
    } else if (headerLower.includes('post id') || headerLower === 'id') {
      columnRatios.push(2.0); // Post ID needs more space
    } else if (headerLower.includes('rate') || headerLower.includes('engagement')) {
      columnRatios.push(2.0); // Engagement rate
    } else if (headerLower.includes('date')) {
      columnRatios.push(2.0); // Date column
    } else if (headerLower.includes('platform')) {
      columnRatios.push(1.8); // Platform name
    } else if (headerLower.includes('likes')) {
      columnRatios.push(1.5);
    } else if (headerLower.includes('comments')) {
      columnRatios.push(1.8);
    } else if (headerLower.includes('shares')) {
      columnRatios.push(1.5);
    } else if (headerLower.includes('impressions')) {
      columnRatios.push(2.0);
    } else if (headerLower.includes('reach')) {
      columnRatios.push(1.5);
    } else if (headerLower.includes('clicks')) {
      columnRatios.push(1.5);
    } else if (headerLower.includes('views')) {
      columnRatios.push(1.5);
    } else if (headerLower.includes('followers') || headerLower.includes('growth')) {
      columnRatios.push(2.0);
    } else {
      columnRatios.push(1.8);
    }
  });

  const totalRatio = columnRatios.reduce((sum, ratio) => sum + ratio, 0);
  const cellPadding = 2; // Reduced padding to fit more content
  // Calculate available width more accurately
  const totalPadding = numColumns * cellPadding * 2;
  const availableWidth = maxWidth - totalPadding;

  // Calculate column widths with minimum based on header text length
  const columnWidths = columnRatios.map((ratio, index) => {
    const baseWidth = (ratio / totalRatio) * availableWidth;
    const header = data.headers[index];
    if (!header) {
      return baseWidth;
    }
    // Calculate minimum width needed for header text (approximate)
    const headerLength = header.length;
    const minWidthForHeader = Math.max(headerLength * 2.5, 18); // At least 18mm, or based on text length
    return Math.max(baseWidth, minWidthForHeader);
  });

  // Recalculate if columns are too wide (scale down proportionally)
  const totalCalculatedWidth = columnWidths.reduce((sum, w) => sum + w, 0) + totalPadding;
  if (totalCalculatedWidth > maxWidth) {
    const scaleFactor = (maxWidth - totalPadding) / (totalCalculatedWidth - totalPadding);
    columnWidths.forEach((width, index) => {
      columnWidths[index] = Math.max(width * scaleFactor, 16); // Ensure minimum 16mm even after scaling
    });
  }

  // Headers with better styling
  checkPageBreak(lineHeight * 4);
  doc.setFontSize(headerFontSize);
  doc.setFont('helvetica', 'bold');

  let xPosition = margin;
  // Calculate header height based on longest header text
  let maxHeaderLines = 1;
  data.headers.forEach((header, index) => {
    const colWidth = columnWidths[index];
    if (!colWidth) {
      return;
    }
    const headerText = doc.splitTextToSize(String(header), colWidth - (cellPadding * 2));
    maxHeaderLines = Math.max(maxHeaderLines, headerText.length);
  });
  const headerHeight = Math.max(lineHeight * 1.8, maxHeaderLines * lineHeight + lineHeight * 0.6);

  // Draw header row with brand color background
  doc.setFillColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
  doc.roundedRect(margin, yPosition - lineHeight * 0.7, maxWidth, headerHeight, 2, 2, 'F');

  data.headers.forEach((header, index) => {
    const colWidth = columnWidths[index];
    if (!colWidth) {
      return;
    }
    const availableHeaderWidth = Math.max(colWidth - (cellPadding * 2), 10);
    const headerText = doc.splitTextToSize(String(header), availableHeaderWidth);

    // White text on colored background
    doc.setTextColor(255, 255, 255);

    // Center align headers, but ensure they fit
    headerText.forEach((line: string, lineIndex: number) => {
      const textY = yPosition + (lineIndex * lineHeight) + lineHeight * 0.5;
      const textX = xPosition + colWidth / 2;
      doc.text(line, textX, textY, { align: 'center', maxWidth: availableHeaderWidth });
    });

    xPosition += colWidth + (cellPadding * 2);
  });

  doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
  yPosition += headerHeight + lineHeight * 0.5;

  // Data rows with better styling
  doc.setFont('helvetica', 'normal');
  data.rows.forEach((row, rowIndex) => {
    // Calculate the maximum height needed for this row
    let maxCellHeight = lineHeight * 1.4;
    const cellHeights: number[] = [];
    const cellTexts: string[][] = [];

    row.forEach((cell, cellIndex) => {
      let cellValue: string;

      // Format cell value appropriately
      if (cell === null || cell === undefined || cell === '') {
        cellValue = '-';
      } else if (typeof cell === 'number') {
        cellValue = formatNumber(cell);
      } else {
        cellValue = String(cell);
        // Truncate very long content (e.g., post content)
        const header = data.headers[cellIndex];
        if (header) {
          const headerLower = header.toLowerCase();
          if (headerLower.includes('content') && cellValue.length > 100) {
            cellValue = `${cellValue.substring(0, 97)}...`;
          }
        }
      }

      const colWidthForCell = columnWidths[cellIndex];
      if (!colWidthForCell) {
        cellTexts.push(['-']);
        cellHeights.push(lineHeight);
        return;
      }
      const availableCellWidth = Math.max(colWidthForCell - (cellPadding * 2), 8); // Ensure minimum width
      const cellText = doc.splitTextToSize(cellValue, availableCellWidth);
      cellTexts.push(cellText);
      const cellHeight = Math.max(lineHeight * 1.3, cellText.length * lineHeight + lineHeight * 0.4);
      cellHeights.push(cellHeight);
      maxCellHeight = Math.max(maxCellHeight, cellHeight);
    });

    checkPageBreak(maxCellHeight + lineHeight);

    // Draw row background (alternating colors for better readability)
    const rowColor = rowIndex % 2 === 0 ? colors.rowEven : colors.rowOdd;
    doc.setFillColor(rowColor[0]!, rowColor[1]!, rowColor[2]!);
    doc.roundedRect(margin, yPosition - lineHeight * 0.7, maxWidth, maxCellHeight, 1, 1, 'F');

    xPosition = margin;
    row.forEach((cell, cellIndex) => {
      // Ensure we don't exceed page width
      if (xPosition >= pageWidth - margin) {
        return; // Skip if we've run out of space
      }

      const colWidth = columnWidths[cellIndex];
      if (!colWidth) {
        return;
      }
      const cellText = cellTexts[cellIndex];

      // Ensure column doesn't exceed page bounds
      const actualColWidth = Math.min(colWidth, pageWidth - margin - xPosition);

      // Draw cell border (subtle)
      doc.setDrawColor(colors.border[0]!, colors.border[1]!, colors.border[2]!);
      doc.setLineWidth(0.2);
      doc.rect(xPosition, yPosition - lineHeight * 0.7, actualColWidth, maxCellHeight, 'S');

      // Add cell content with proper alignment
      doc.setFontSize(smallFontSize);
      const headerLower = data.headers[cellIndex]?.toLowerCase() || '';
      const align = headerLower.includes('content') || headerLower.includes('id')
        ? 'left'
        : headerLower.includes('rate') || headerLower.includes('engagement')
          || headerLower.includes('likes') || headerLower.includes('comments')
          || headerLower.includes('shares') || headerLower.includes('impressions')
          || headerLower.includes('followers') || headerLower.includes('growth')
          || headerLower.includes('clicks') || headerLower.includes('views')
          || headerLower.includes('reach')
          ? 'right'
          : 'left';

      // Use primary color for numbers in engagement/metrics columns
      const isMetricColumn = headerLower.includes('likes') || headerLower.includes('comments')
        || headerLower.includes('shares') || headerLower.includes('impressions')
        || headerLower.includes('followers') || headerLower.includes('growth')
        || headerLower.includes('clicks') || headerLower.includes('views')
        || headerLower.includes('reach');

      if (isMetricColumn && typeof cell === 'number' && cell > 0) {
        doc.setTextColor(colors.primary[0]!, colors.primary[1]!, colors.primary[2]!);
      } else {
        doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
      }

      // Calculate text position
      const textX = align === 'right'
        ? xPosition + actualColWidth - cellPadding
        : xPosition + cellPadding;

      // Render cell text - ensure all values are displayed properly
      if (cellText && cellText.length > 0) {
        // Render each line of the cell text
        cellText.forEach((line: string, lineIndex: number) => {
          const textY = yPosition + (lineIndex * lineHeight) + lineHeight * 0.35;
          // Ensure we don't go beyond page boundaries
          if (textY < pageHeight - margin - 15 && textX < pageWidth - margin) {
            try {
              const maxTextWidth = actualColWidth - (cellPadding * 2);
              if (maxTextWidth > 5) { // Only render if we have enough space
                doc.text(line, textX, textY, { align, maxWidth: maxTextWidth });
              }
            } catch {
              // Fallback: render truncated text
              const displayValue = line.length > 30 ? `${line.substring(0, 27)}...` : line;
              doc.text(displayValue, textX, textY, { align: 'left' });
            }
          }
        });
      } else {
        // Render dash for empty cells, centered
        const dashY = yPosition + lineHeight * 0.35;
        if (dashY < pageHeight - margin - 15) {
          doc.text('-', xPosition + actualColWidth / 2, dashY, { align: 'center' });
        }
      }

      doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
      xPosition += actualColWidth + (cellPadding * 2);
    });

    yPosition += maxCellHeight + lineHeight * 0.3;
  });

  // Add footer with page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(colors.border[0]!, colors.border[1]!, colors.border[2]!);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

    // Page number
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.textLight[0]!, colors.textLight[1]!, colors.textLight[2]!);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });

    // Footer text
    doc.text('Hello Brand - Social Media Analytics', margin, pageHeight - 12, { align: 'left' });
    doc.setTextColor(colors.text[0]!, colors.text[1]!, colors.text[2]!);
  }

  // Return PDF as Buffer
  try {
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  } catch (error) {
    console.error('[PDF Generation] Error:', error);
    // Fallback: return a simple PDF
    // eslint-disable-next-line new-cap
    const fallbackDoc = new jsPDF('p', 'mm', 'a4');
    fallbackDoc.text('Error generating PDF report', 20, 20);
    return Buffer.from(fallbackDoc.output('arraybuffer'));
  }
}
