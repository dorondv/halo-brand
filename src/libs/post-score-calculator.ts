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
 * Includes minimum thresholds to prevent inflated scores
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

  // Apply minimum thresholds to prevent inflated scores when benchmarks are too low
  // These thresholds ensure that posts with very low engagement don't get high scores
  const MIN_ENGAGEMENT_THRESHOLD = 5; // Minimum engagement to be considered "good"
  const MIN_IMPRESSIONS_THRESHOLD = 10; // Minimum impressions to be considered meaningful
  const MIN_ENGAGEMENT_RATE_THRESHOLD = 0.5; // Minimum 0.5% engagement rate

  return {
    topImpressions: Math.max(topImpressions, MIN_IMPRESSIONS_THRESHOLD),
    topEngagement: Math.max(topEngagement, MIN_ENGAGEMENT_THRESHOLD),
    topEngagementRate: Math.max(topEngagementRate, MIN_ENGAGEMENT_RATE_THRESHOLD),
    avgImpressions: Math.max(avgImpressions, MIN_IMPRESSIONS_THRESHOLD),
    avgEngagement: Math.max(avgEngagement, MIN_ENGAGEMENT_THRESHOLD),
    avgEngagementRate: Math.max(avgEngagementRate, MIN_ENGAGEMENT_RATE_THRESHOLD),
  };
}

/**
 * Calculate smart relative score for a post
 * Score is 0-100, combining relative performance with absolute performance indicators
 * This ensures posts with objectively better metrics score higher
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
    // Cap at 50 for posts without benchmarks to prevent inflated scores
    return Math.min(50, Math.floor(metrics.engagementRate * 2 + Math.min(metrics.engagement / 100, 30)));
  }

  // PART 1: Relative performance score (0-70 points max)
  // Normalize metrics relative to benchmarks
  // Each metric contributes to the score:
  // - Impressions: 25% weight
  // - Engagement: 50% weight (most important)
  // - Engagement Rate: 25% weight

  // Normalize impressions (0-1 scale) with logarithmic scaling for better distribution
  const impressionsScore = benchmarks.topImpressions > 0
    ? Math.min(1, Math.log10(1 + metrics.impressions) / Math.log10(1 + benchmarks.topImpressions))
    : 0;

  // Normalize engagement (0-1 scale) with logarithmic scaling
  const engagementScore = benchmarks.topEngagement > 0
    ? Math.min(1, Math.log10(1 + metrics.engagement) / Math.log10(1 + benchmarks.topEngagement))
    : 0;

  // Normalize engagement rate (0-1 scale) - linear for percentage
  const engagementRateScore = benchmarks.topEngagementRate > 0
    ? Math.min(1, metrics.engagementRate / benchmarks.topEngagementRate)
    : 0;

  // Calculate weighted composite score (relative performance)
  const relativeScore = (
    impressionsScore * 0.25
    + engagementScore * 0.50
    + engagementRateScore * 0.25
  ) * 70; // Scale to 0-70 points

  // PART 2: Absolute performance bonus (0-30 points max)
  // Reward posts with objectively good metrics regardless of relative performance
  let absoluteBonus = 0;

  // Engagement bonus: reward posts with meaningful engagement
  if (metrics.engagement >= 20) {
    absoluteBonus += 15; // High engagement bonus
  } else if (metrics.engagement >= 10) {
    absoluteBonus += 10; // Medium engagement bonus
  } else if (metrics.engagement >= 5) {
    absoluteBonus += 5; // Low engagement bonus
  }

  // Engagement rate bonus: reward posts with good engagement rates
  if (metrics.engagementRate >= 5) {
    absoluteBonus += 10; // Excellent engagement rate
  } else if (metrics.engagementRate >= 2) {
    absoluteBonus += 5; // Good engagement rate
  } else if (metrics.engagementRate >= 1) {
    absoluteBonus += 2; // Decent engagement rate
  }

  // Impressions bonus: reward posts with good reach
  if (metrics.impressions >= 1000) {
    absoluteBonus += 5; // High impressions
  } else if (metrics.impressions >= 500) {
    absoluteBonus += 3; // Medium impressions
  } else if (metrics.impressions >= 100) {
    absoluteBonus += 1; // Low impressions
  }

  // Cap absolute bonus at 30 points
  absoluteBonus = Math.min(30, absoluteBonus);

  // PART 3: Bonus for exceeding top benchmarks (0-10 points max)
  let benchmarkBonus = 0;
  if (metrics.impressions >= benchmarks.topImpressions && benchmarks.topImpressions > 0) {
    benchmarkBonus += 3; // Bonus for top impressions
  }
  if (metrics.engagement >= benchmarks.topEngagement && benchmarks.topEngagement > 0) {
    benchmarkBonus += 4; // Bonus for top engagement (most important)
  }
  if (metrics.engagementRate >= benchmarks.topEngagementRate && benchmarks.topEngagementRate > 0) {
    benchmarkBonus += 3; // Bonus for top engagement rate
  }
  benchmarkBonus = Math.min(10, benchmarkBonus);

  // Calculate final score: relative (0-70) + absolute bonus (0-30) + benchmark bonus (0-10)
  let finalScore = relativeScore + absoluteBonus + benchmarkBonus;

  // Ensure posts with very low engagement don't score too high
  // If engagement is less than 2, cap the score at 40
  if (metrics.engagement < 2) {
    finalScore = Math.min(40, finalScore);
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
