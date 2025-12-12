/**
 * Smart Post Score Calculator
 * Calculates a relative score for posts based on:
 * - Impressions
 * - Total engagement (likes + comments + shares)
 * - Engagement rate
 *
 * The score is relative to the brand's top 10 posts of the same type
 * (e.g., Instagram Stories compared to Instagram Stories)
 */

export type PostMetrics = {
  impressions: number;
  engagement: number; // likes + comments + shares
  engagementRate: number; // percentage
};

export type PostWithMetrics = {
  id: string;
  platform: string;
  postType: string; // 'story', 'feed', 'reel', 'carousel', etc.
  metrics: PostMetrics;
};

/**
 * Detect post type from metadata and platform
 */
export function detectPostType(
  platform: string,
  metadata: any,
  mediaUrls?: string[],
): string {
  const normalizedPlatform = platform.toLowerCase();
  const mediaType = metadata?.mediaType?.toLowerCase() || '';
  const mediaCount = mediaUrls?.length || 0;
  const hasVideo = mediaUrls?.some(url =>
    url.toLowerCase().includes('.mp4')
    || url.toLowerCase().includes('.mov')
    || url.toLowerCase().includes('.avi')
    || url.toLowerCase().includes('.webm')
    || url.toLowerCase().includes('video'),
  ) || false;

  // Check metadata for explicit post type
  if (metadata?.contentType) {
    return metadata.contentType.toLowerCase();
  }
  if (metadata?.format) {
    return metadata.format.toLowerCase();
  }
  if (metadata?.postType) {
    return metadata.postType.toLowerCase();
  }

  // Detect based on platform and media characteristics
  if (normalizedPlatform === 'instagram') {
    if (mediaType.includes('story') || metadata?.isStory) {
      return 'story';
    }
    if (mediaType.includes('reel') || metadata?.isReel) {
      return 'reel';
    }
    if (mediaCount > 1) {
      return 'carousel';
    }
    if (hasVideo) {
      return 'reel';
    }
    return 'feed';
  }

  if (normalizedPlatform === 'facebook') {
    if (mediaType.includes('story') || metadata?.isStory) {
      return 'story';
    }
    if (hasVideo) {
      return 'video';
    }
    if (mediaCount > 1) {
      return 'feed'; // Facebook multi-image posts
    }
    return 'feed';
  }

  if (normalizedPlatform === 'x' || normalizedPlatform === 'twitter') {
    if (metadata?.isThread || mediaCount > 4) {
      return 'thread';
    }
    return 'post';
  }

  if (normalizedPlatform === 'tiktok') {
    if (mediaCount > 1) {
      return 'carousel';
    }
    return 'video';
  }

  if (normalizedPlatform === 'youtube') {
    // YouTube videos are typically > 3 min, shorts are ≤ 3 min
    // We can't determine this from metadata alone, so default to 'video'
    return 'video';
  }

  if (normalizedPlatform === 'linkedin') {
    return 'post';
  }

  // Default fallback
  if (hasVideo) {
    return 'video';
  }
  if (mediaCount > 1) {
    return 'carousel';
  }
  return 'post';
}

/**
 * Calculate benchmark metrics from top 10 posts of the same type
 */
function calculateBenchmarks(
  posts: PostWithMetrics[],
  platform: string,
  postType: string,
): {
  topImpressions: number;
  topEngagement: number;
  topEngagementRate: number;
  avgImpressions: number;
  avgEngagement: number;
  avgEngagementRate: number;
} {
  // Filter posts by platform and type
  const filteredPosts = posts.filter(
    p => p.platform.toLowerCase() === platform.toLowerCase()
      && p.postType.toLowerCase() === postType.toLowerCase(),
  );

  if (filteredPosts.length === 0) {
    // No posts of this type, return zeros
    return {
      topImpressions: 0,
      topEngagement: 0,
      topEngagementRate: 0,
      avgImpressions: 0,
      avgEngagement: 0,
      avgEngagementRate: 0,
    };
  }

  // Sort by a composite score (impressions * engagement rate + engagement)
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    const scoreA = a.metrics.impressions * (a.metrics.engagementRate / 100) + a.metrics.engagement;
    const scoreB = b.metrics.impressions * (b.metrics.engagementRate / 100) + b.metrics.engagement;
    return scoreB - scoreA;
  });

  // Get top 10 posts
  const top10 = sortedPosts.slice(0, Math.min(10, sortedPosts.length));

  // Calculate benchmarks from top 10
  const topImpressions = Math.max(...top10.map(p => p.metrics.impressions), 0);
  const topEngagement = Math.max(...top10.map(p => p.metrics.engagement), 0);
  const topEngagementRate = Math.max(...top10.map(p => p.metrics.engagementRate), 0);

  const avgImpressions = top10.reduce((sum, p) => sum + p.metrics.impressions, 0) / top10.length;
  const avgEngagement = top10.reduce((sum, p) => sum + p.metrics.engagement, 0) / top10.length;
  const avgEngagementRate = top10.reduce((sum, p) => sum + p.metrics.engagementRate, 0) / top10.length;

  return {
    topImpressions,
    topEngagement,
    topEngagementRate,
    avgImpressions,
    avgEngagement,
    avgEngagementRate,
  };
}

/**
 * Calculate smart relative score for a post
 * Score is 0-100, relative to brand's top 10 posts of the same type
 */
export function calculateSmartScore(
  post: PostWithMetrics,
  allBrandPosts: PostWithMetrics[],
): number {
  const { metrics, platform, postType } = post;

  // Get benchmarks for this post type
  const benchmarks = calculateBenchmarks(allBrandPosts, platform, postType);

  // If no benchmarks available, use a simple fallback score
  if (
    benchmarks.topImpressions === 0
    && benchmarks.topEngagement === 0
    && benchmarks.topEngagementRate === 0
  ) {
    // Fallback: simple score based on engagement rate and engagement
    return Math.min(100, Math.floor(metrics.engagementRate * 2 + Math.min(metrics.engagement / 100, 50)));
  }

  // Normalize metrics relative to benchmarks
  // Each metric contributes to the score:
  // - Impressions: 30% weight
  // - Engagement: 40% weight
  // - Engagement Rate: 30% weight

  // Normalize impressions (0-1 scale)
  const impressionsScore = benchmarks.topImpressions > 0
    ? Math.min(1, metrics.impressions / benchmarks.topImpressions)
    : 0;

  // Normalize engagement (0-1 scale)
  const engagementScore = benchmarks.topEngagement > 0
    ? Math.min(1, metrics.engagement / benchmarks.topEngagement)
    : 0;

  // Normalize engagement rate (0-1 scale)
  const engagementRateScore = benchmarks.topEngagementRate > 0
    ? Math.min(1, metrics.engagementRate / benchmarks.topEngagementRate)
    : 0;

  // Calculate weighted composite score
  const compositeScore
    = impressionsScore * 0.3
      + engagementScore * 0.4
      + engagementRateScore * 0.3;

  // Convert to 0-100 scale
  // Use a curve to make the score distribution more meaningful
  // Posts that exceed benchmarks get bonus points
  let finalScore = compositeScore * 100;

  // Bonus for exceeding top benchmarks
  if (metrics.impressions >= benchmarks.topImpressions && benchmarks.topImpressions > 0) {
    finalScore += 5; // Bonus for top impressions
  }
  if (metrics.engagement >= benchmarks.topEngagement && benchmarks.topEngagement > 0) {
    finalScore += 5; // Bonus for top engagement
  }
  if (metrics.engagementRate >= benchmarks.topEngagementRate && benchmarks.topEngagementRate > 0) {
    finalScore += 5; // Bonus for top engagement rate
  }

  // Cap at 100
  finalScore = Math.min(100, Math.max(0, finalScore));

  // Round to nearest integer
  return Math.round(finalScore);
}

/**
 * Calculate scores for all posts in a batch
 * More efficient than calculating individually
 * Returns Map<string, number> where key is post ID and value is score (0-100)
 */
export function calculateScoresForPosts(
  posts: Array<{
    id: string;
    platform: string;
    metadata?: any;
    mediaUrls?: string[];
    metrics: PostMetrics;
  }>,
): Map<string, number> {
  // If no posts, return empty map
  if (!posts || posts.length === 0) {
    return new Map<string, number>();
  }

  // Convert to PostWithMetrics format
  const postsWithTypes: PostWithMetrics[] = posts.map(post => ({
    id: post.id,
    platform: post.platform,
    postType: detectPostType(post.platform, post.metadata || {}, post.mediaUrls),
    metrics: {
      impressions: Number(post.metrics.impressions || 0),
      engagement: Number(post.metrics.engagement || 0),
      engagementRate: Number(post.metrics.engagementRate || 0),
    },
  }));

  // Calculate scores for all posts
  const scores = new Map<string, number>();
  for (const post of postsWithTypes) {
    const score = calculateSmartScore(post, postsWithTypes);
    // Ensure score is between 0-100 and rounded
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    scores.set(post.id, finalScore);
  }

  return scores;
}
