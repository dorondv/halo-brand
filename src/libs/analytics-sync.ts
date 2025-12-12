import type { SupabaseClient } from '@supabase/supabase-js';
import { createGetlateClient } from './Getlate';

/**
 * Sync analytics from Getlate API to database
 * This function can be called from both API routes and server components
 */
export async function syncAnalyticsFromGetlate(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  options?: {
    postId?: string; // Local post ID (UUID) - will be used to find Getlate post ID
    getlatePostId?: string; // Getlate post ID - use this if you have it directly
    platform?: string;
    fromDate?: string;
    toDate?: string;
  },
): Promise<void> {
  try {
    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', userId)
      .single();

    if (!userRecord?.getlate_api_key) {
      return; // No Getlate API key, skip sync
    }

    // Get brand's Getlate profile ID
    const { data: brandRecord } = await supabase
      .from('brands')
      .select('getlate_profile_id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (!brandRecord?.getlate_profile_id) {
      return; // Brand not linked to Getlate profile, skip sync
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);

    // Determine Getlate post ID if local post ID was provided
    let getlatePostIdForQuery: string | undefined = options?.getlatePostId;
    if (!getlatePostIdForQuery && options?.postId) {
      // Find the Getlate post ID from the local post
      const { data: postRecord } = await supabase
        .from('posts')
        .select('getlate_post_id')
        .eq('id', options.postId)
        .single();

      getlatePostIdForQuery = postRecord?.getlate_post_id || undefined;
    }

    // Fetch analytics from Getlate with pagination support
    // Getlate API supports pagination: limit (default: 50, max: 100), page (default: 1)
    // Rate limit: 150 requests per hour per user (for refresh operations)
    // Reading cached analytics data does not count against rate limit
    // We'll fetch all pages to get comprehensive data
    let allGetlateAnalytics: any[] = [];
    let currentPage = 1;
    const pageSize = 50; // Max allowed by Getlate API
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const analyticsResponse = await getlateClient.getAnalytics({
          profileId: brandRecord.getlate_profile_id,
          postId: getlatePostIdForQuery, // Use Getlate post ID for query
          platform: options?.platform as any,
          fromDate: options?.fromDate,
          toDate: options?.toDate,
          limit: pageSize,
          page: currentPage,
          sortBy: 'date', // Sort by date for consistent ordering
          order: 'desc', // Most recent first
        });

        // Extract posts from the structured response
        const pageAnalytics = analyticsResponse.posts || [];

        // If we got fewer results than pageSize, we've reached the last page
        if (pageAnalytics.length < pageSize) {
          hasMorePages = false;
        }

        // Also check pagination info if available
        if (analyticsResponse.pagination) {
          if (currentPage >= analyticsResponse.pagination.pages) {
            hasMorePages = false;
          }
        }

        allGetlateAnalytics = [...allGetlateAnalytics, ...pageAnalytics];

        // If no analytics returned, stop pagination
        if (pageAnalytics.length === 0) {
          hasMorePages = false;
        }

        currentPage++;

        // Safety limit: don't fetch more than 20 pages (1000 records max)
        // This prevents infinite loops and respects rate limits
        if (currentPage > 20) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[syncAnalyticsFromGetlate] Reached pagination limit (20 pages)');
          }
          hasMorePages = false;
        }
      } catch (error: any) {
        // Handle rate limit errors (HTTP 429)
        if (error?.message?.includes('429') || error?.message?.includes('rate limit')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[syncAnalyticsFromGetlate] Rate limit reached, stopping pagination');
          }
          hasMorePages = false;
        } else {
          // For other errors, log and stop
          if (process.env.NODE_ENV === 'development') {
            console.error('[syncAnalyticsFromGetlate] Error fetching page', currentPage, ':', error);
          }
          hasMorePages = false;
        }
      }
    }

    const getlateAnalytics = allGetlateAnalytics;

    // Sync analytics to database
    for (const post of getlateAnalytics) {
      // GetlateAnalyticsPost uses _id field (External Post ID from synced analytics)
      // Also supports postId field (Late Post ID for posts scheduled via API)
      // Both IDs can be used to correlate posts - platformPostUrl is the unique identifier
      const getlatePostId = post._id || post.id; // External Post ID
      // Note: post.postId (Late Post ID) is available but not currently used in sync logic
      if (!getlatePostId) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[syncAnalyticsFromGetlate] Post missing _id or id:', post);
        }
        continue;
      }

      // Verify that the Getlate post belongs to the user's profile
      // This ensures we only sync analytics for posts that belong to the current user
      if (post.profileId && post.profileId !== brandRecord.getlate_profile_id) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[syncAnalyticsFromGetlate] Post ${getlatePostId} belongs to profile ${post.profileId}, but we're syncing for profile ${brandRecord.getlate_profile_id}. Skipping.`);
        }
        continue; // Skip posts that don't belong to the user's profile
      }

      // Find post by Getlate post ID - MUST filter by user_id and brand_id for security
      const { data: postRecord } = await supabase
        .from('posts')
        .select('id')
        .eq('getlate_post_id', getlatePostId)
        .eq('user_id', userId)
        .eq('brand_id', brandId)
        .maybeSingle();

      // If not found by exact match, try to find by partial match (still with user/brand filter)
      let foundPost = postRecord || null;
      if (!foundPost) {
        const { data: allPosts } = await supabase
          .from('posts')
          .select('id, getlate_post_id')
          .eq('user_id', userId)
          .eq('brand_id', brandId)
          .not('getlate_post_id', 'is', null);

        const matchedPost = allPosts?.find(p =>
          p.getlate_post_id === getlatePostId
          || String(p.getlate_post_id) === String(getlatePostId),
        );
        foundPost = matchedPost ? { id: matchedPost.id } : null;
      }

      // Update existing post with latest data from Getlate analytics if needed
      if (foundPost) {
        try {
          // Extract updated data from analytics
          const platformsArray = post.platforms && Array.isArray(post.platforms)
            ? post.platforms.map((p: any) => ({
                platform: typeof p === 'string' ? p : (p.platform || 'unknown'),
                status: typeof p === 'object' && p.status ? p.status : null,
                accountId: typeof p === 'object' && p.accountId ? p.accountId : null,
              }))
            : post.platform
              ? [{ platform: post.platform, status: null, accountId: null }]
              : [];

          // Get existing post metadata to merge
          const { data: existingPost } = await supabase
            .from('posts')
            .select('metadata')
            .eq('id', foundPost.id)
            .single();

          const existingMetadata = (existingPost?.metadata as Record<string, any>) || {};

          // Prepare update object
          const updateData: any = {
            updated_at: new Date().toISOString(),
          };

          // Update platforms if available
          if (platformsArray.length > 0) {
            updateData.platforms = platformsArray;
          }

          // Update status if it's a valid value
          if (post.status === 'published' || post.status === 'scheduled' || post.status === 'draft') {
            updateData.status = post.status;
          }

          // Merge metadata (preserve existing, add/update new fields from analytics)
          updateData.metadata = {
            ...existingMetadata,
            publishedAt: post.publishedAt || existingMetadata.publishedAt || null,
            scheduledFor: post.scheduledFor || existingMetadata.scheduledFor || null,
            platformPostUrl: post.platformPostUrl || existingMetadata.platformPostUrl || null,
            isExternal: post.isExternal !== undefined ? post.isExternal : (existingMetadata.isExternal !== undefined ? existingMetadata.isExternal : false),
            mediaItems: post.mediaItems || existingMetadata.mediaItems || null,
            mediaType: post.mediaType || existingMetadata.mediaType || null,
            thumbnailUrl: post.thumbnailUrl || existingMetadata.thumbnailUrl || null,
            profileId: post.profileId || existingMetadata.profileId || null,
          };

          // Update post with latest data
          const { error: updateError } = await supabase
            .from('posts')
            .update(updateData)
            .eq('id', foundPost.id);

          if (updateError && process.env.NODE_ENV === 'development') {
            console.warn(`[syncAnalyticsFromGetlate] Error updating post ${foundPost.id}:`, updateError);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[syncAnalyticsFromGetlate] Error updating existing post ${foundPost.id}:`, error);
          }
        }
      }

      // If post not found in local database, create a minimal post record from Getlate analytics
      // This allows us to track analytics for posts created directly in Getlate or external posts
      if (!foundPost) {
        try {
          // Extract post data from Getlate analytics response
          const postContent = post.content || 'Post from Getlate';
          const publishedDate = post.publishedAt
            ? new Date(post.publishedAt)
            : post.scheduledFor
              ? new Date(post.scheduledFor)
              : new Date();

          // Determine media type from analytics data
          const mediaType = post.mediaType === 'video'
            ? 'video'
            : post.thumbnailUrl || (post.mediaItems && Array.isArray(post.mediaItems) && post.mediaItems.length > 0)
              ? 'image'
              : 'text';

          // Extract media URLs from mediaItems if available
          const mediaUrls: string[] = [];
          if (post.mediaItems && Array.isArray(post.mediaItems)) {
            for (const item of post.mediaItems) {
              if (typeof item === 'object' && item !== null && 'url' in item) {
                mediaUrls.push((item as any).url);
              } else if (typeof item === 'string') {
                mediaUrls.push(item);
              }
            }
          }
          // Use first media URL as image_url if thumbnailUrl not available
          const imageUrl = post.thumbnailUrl || (mediaUrls.length > 0 ? mediaUrls[0] : null);

          // Extract platforms array from analytics response
          const platformsArray = post.platforms && Array.isArray(post.platforms)
            ? post.platforms.map((p: any) => ({
                platform: typeof p === 'string' ? p : (p.platform || 'unknown'),
                status: typeof p === 'object' && p.status ? p.status : null,
                accountId: typeof p === 'object' && p.accountId ? p.accountId : null,
              }))
            : post.platform
              ? [{ platform: post.platform, status: null, accountId: null }]
              : [];

          // Extract hashtags from content (simple regex match)
          const hashtagRegex = /#[\w\u0590-\u05FF]+/g;
          const hashtags = postContent.match(hashtagRegex) || [];

          // Create a minimal post record in local database with all available data
          const { data: newPost, error: createError } = await supabase
            .from('posts')
            .insert({
              user_id: userId,
              brand_id: brandId,
              content: postContent,
              image_url: imageUrl,
              media_type: mediaType,
              hashtags: hashtags.length > 0 ? hashtags : null,
              getlate_post_id: getlatePostId,
              platforms: platformsArray.length > 0 ? platformsArray : null,
              status: post.status === 'published'
                ? 'published'
                : post.status === 'scheduled'
                  ? 'scheduled'
                  : 'draft',
              metadata: {
                isExternal: post.isExternal || false,
                platformPostUrl: post.platformPostUrl,
                syncedFromGetlate: true,
                syncedAt: new Date().toISOString(),
                publishedAt: post.publishedAt || null,
                scheduledFor: post.scheduledFor || null,
                mediaItems: post.mediaItems || null,
                mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
                profileId: post.profileId || null,
                thumbnailUrl: post.thumbnailUrl || null,
                mediaType: post.mediaType || null,
              },
              created_at: publishedDate.toISOString(),
              updated_at: publishedDate.toISOString(),
            })
            .select('id')
            .single();

          if (createError || !newPost) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`[syncAnalyticsFromGetlate] Failed to create post for ${getlatePostId}:`, createError);
            }
            continue; // Skip this post if we can't create it
          }

          foundPost = { id: newPost.id };

          if (process.env.NODE_ENV === 'development') {
            console.warn(`[syncAnalyticsFromGetlate] Created post record for Getlate post ${getlatePostId} (local ID: ${newPost.id})`);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[syncAnalyticsFromGetlate] Error creating post for ${getlatePostId}:`, error);
          }
          continue; // Skip this post if creation fails
        }
      }

      // Determine the date for analytics (use publishedAt, scheduledFor, or current date)
      // Normalize to date-only (midnight) for consistent daily aggregation
      const publishedDateRaw = post.publishedAt
        ? new Date(post.publishedAt)
        : post.scheduledFor
          ? new Date(post.scheduledFor)
          : new Date();

      // Normalize to date-only (set to midnight UTC for consistent storage)
      const publishedDate = new Date(Date.UTC(
        publishedDateRaw.getFullYear(),
        publishedDateRaw.getMonth(),
        publishedDateRaw.getDate(),
      ));

      // Handle multiple platforms: GetlateAnalyticsPost can have analytics per platform
      // Late API returns either 'platforms' array (list endpoint) or 'platformAnalytics' array (single post endpoint)
      const platformsToProcess: Array<{
        platform: string;
        analytics: {
          impressions?: number;
          reach?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          clicks?: number;
          views?: number;
          engagementRate?: number;
          lastUpdated?: string;
        };
        accountId?: string; // From platformAnalytics (single post endpoint)
        accountUsername?: string; // From platformAnalytics (single post endpoint)
      }> = [];

      // Priority 1: Check platformAnalytics (from single post endpoint)
      // This is the structure returned by GET /v1/analytics?postId=xxx
      if (post.platformAnalytics && Array.isArray(post.platformAnalytics) && post.platformAnalytics.length > 0) {
        for (const platformData of post.platformAnalytics) {
          if (platformData.platform && platformData.analytics) {
            platformsToProcess.push({
              platform: platformData.platform,
              analytics: platformData.analytics,
            });
          }
        }
      }

      // Priority 2: Check platforms array (from list endpoint)
      if (platformsToProcess.length === 0 && post.platforms && Array.isArray(post.platforms) && post.platforms.length > 0) {
        for (const platformData of post.platforms) {
          if (platformData.platform && platformData.analytics) {
            platformsToProcess.push({
              platform: platformData.platform,
              analytics: platformData.analytics,
            });
          }
        }
      }

      // Priority 3: If no platform-specific analytics but post-level analytics exist, use those
      if (platformsToProcess.length === 0 && post.analytics) {
        // Use the post-level platform or default to 'unknown'
        const platform = post.platform || 'unknown';
        platformsToProcess.push({
          platform,
          analytics: post.analytics,
        });
      }

      // If still no analytics, skip this post
      if (platformsToProcess.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[syncAnalyticsFromGetlate] Post ${getlatePostId} has no analytics data, skipping`);
        }
        continue;
      }

      // Process each platform's analytics separately
      for (const { platform, analytics: platformAnalytics, accountId, accountUsername } of platformsToProcess) {
        // Extract ALL metrics directly from Getlate API analytics object
        // These values come directly from the API response and represent current/latest values
        const likes = platformAnalytics.likes ?? null;
        const comments = platformAnalytics.comments ?? null;
        const shares = platformAnalytics.shares ?? null;
        const impressions = platformAnalytics.impressions ?? null;
        const reach = platformAnalytics.reach ?? null;
        const clicks = platformAnalytics.clicks ?? null;
        const views = platformAnalytics.views ?? null;
        const engagementRate = platformAnalytics.engagementRate ?? null;

        // Extract platformPostUrl from multiple sources (priority order):
        // 1. platformAnalytics array (from single post endpoint) - has accountId/accountUsername
        // 2. platforms array (from list endpoint) - may have platformPostUrl
        // 3. post.platformPostUrl (top-level)
        let platformPostUrlFromPlatform = null;

        // Priority 1: Check platformAnalytics (single post endpoint)
        if (post.platformAnalytics && Array.isArray(post.platformAnalytics)) {
          const platformData = post.platformAnalytics.find((p: any) => p.platform === platform);
          if (platformData?.platformPostUrl) {
            platformPostUrlFromPlatform = platformData.platformPostUrl;
          }
        }

        // Priority 2: Check platforms array (list endpoint)
        if (!platformPostUrlFromPlatform && post.platforms && Array.isArray(post.platforms)) {
          const platformData = post.platforms.find((p: any) => {
            const pPlatform = typeof p === 'object' ? p.platform : p;
            return pPlatform === platform;
          });
          if (platformData && typeof platformData === 'object' && platformData.platformPostUrl) {
            platformPostUrlFromPlatform = platformData.platformPostUrl;
          }
        }

        // Calculate engagement rate if not provided
        const calculatedEngagementRate = engagementRate !== null
          ? engagementRate
          : (impressions && impressions > 0 && (likes || comments || shares))
              ? ((likes || 0) + (comments || 0) + (shares || 0)) / impressions * 100
              : null;

        // Check if analytics record already exists
        // Use post_id + platform + date as unique identifier (one record per post per platform per day)
        // Since we normalize dates to midnight UTC, we can compare directly
        const normalizedDate = publishedDate.toISOString();
        const { data: existingAnalytics } = await supabase
          .from('post_analytics')
          .select('id, metadata')
          .eq('post_id', foundPost.id)
          .eq('getlate_post_id', getlatePostId)
          .eq('platform', platform)
          .eq('date', normalizedDate)
          .maybeSingle();

        // Find platform-specific status from platforms array
        const platformStatus = post.platforms?.find((p: any) =>
          (typeof p === 'object' && p.platform === platform)
          || (typeof p === 'string' && p === platform),
        );
        const platformStatusValue = typeof platformStatus === 'object' && platformStatus?.status
          ? platformStatus.status
          : null;

        // Get existing metadata to preserve platformPostUrl if it exists
        const existingMetadata = (existingAnalytics?.metadata as Record<string, any>) || {};

        // Build metadata object, preserving existing platformPostUrl if new one is not available
        // Start with existing metadata as base, then merge new data, then explicitly set critical fields
        const metadata = {
          // Start with existing metadata (preserves all existing fields)
          ...existingMetadata,
          // Merge in new metadata from Getlate (overwrites existing with new values)
          ...(post.metadata || {}),
          // Core analytics metrics (always update with latest)
          reach,
          clicks,
          views,
          engagementRate: calculatedEngagementRate !== null ? calculatedEngagementRate : (existingMetadata.engagementRate ?? null),
          lastUpdated: platformAnalytics.lastUpdated,
          // Post metadata - preserve existing values if new ones are not available
          profileId: post.profileId || existingMetadata.profileId || null,
          // CRITICAL: Preserve platformPostUrl if it exists, only update if new one is provided
          // Priority: platformPostUrl from platforms array > post.platformPostUrl > existing > null
          platformPostUrl: platformPostUrlFromPlatform ?? post.platformPostUrl ?? existingMetadata.platformPostUrl ?? null,
          isExternal: post.isExternal !== undefined ? post.isExternal : (existingMetadata.isExternal !== undefined ? existingMetadata.isExternal : false),
          thumbnailUrl: post.thumbnailUrl || existingMetadata.thumbnailUrl || null,
          mediaType: post.mediaType || existingMetadata.mediaType || null,
          // Platform-specific data
          platformStatus: platformStatusValue || existingMetadata.platformStatus || null,
          // Account information (from platformAnalytics - single post endpoint)
          accountId: accountId || existingMetadata.accountId || null,
          accountUsername: accountUsername || existingMetadata.accountUsername || null,
          // Post IDs (both Late Post ID and External Post ID)
          postId: post.postId || existingMetadata.postId || null, // Late Post ID
          getlatePostId: getlatePostId || existingMetadata.getlatePostId || null, // External Post ID (_id)
          // Dates - preserve existing if new ones are not available
          publishedAt: post.publishedAt || existingMetadata.publishedAt || null,
          scheduledFor: post.scheduledFor || existingMetadata.scheduledFor || null,
          // Media data - preserve existing if new ones are not available
          mediaItems: post.mediaItems || existingMetadata.mediaItems || null,
          // Additional metadata from API
          ...(post.metadata || {}),
        };

        const analyticsData = {
          post_id: foundPost.id,
          getlate_post_id: getlatePostId,
          platform,
          likes,
          comments,
          shares,
          impressions,
          engagement_rate: calculatedEngagementRate !== null ? calculatedEngagementRate.toString() : null,
          date: publishedDate.toISOString(), // Store as timestamp (normalized to midnight UTC)
          metadata,
        };

        try {
          if (existingAnalytics) {
            // Update existing record
            const { error: updateError } = await supabase
              .from('post_analytics')
              .update(analyticsData)
              .eq('id', existingAnalytics.id);

            if (updateError) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`[syncAnalyticsFromGetlate] Error updating analytics for post ${getlatePostId}, platform ${platform}:`, updateError);
              }
            }
          } else {
            // Create new record
            const { error: insertError } = await supabase
              .from('post_analytics')
              .insert(analyticsData);

            if (insertError) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`[syncAnalyticsFromGetlate] Error inserting analytics for post ${getlatePostId}, platform ${platform}:`, insertError);
              }
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[syncAnalyticsFromGetlate] Unexpected error syncing analytics for post ${getlatePostId}, platform ${platform}:`, error);
          }
        }
      }
    }
  } catch (error) {
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('[syncAnalyticsFromGetlate] Error:', error);
    }
    throw error; // Re-throw so caller knows sync failed
  }
}
