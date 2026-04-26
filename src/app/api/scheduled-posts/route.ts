import type { NextRequest } from 'next/server';
import type { GetlatePost } from '@/libs/Getlate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

function maxValidDate(values: Array<string | Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const v of values) {
    if (!v) {
      continue;
    }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      continue;
    }
    if (!best || d > best) {
      best = d;
    }
  }
  return best;
}

/**
 * GET /api/scheduled-posts
 * Get scheduled posts within a date range
 * Includes posts from both database and Publishing integration API
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const brandId = searchParams.get('brandId');

  const QuerySchema = z.object({
    start: z.string().nullish(),
    end: z.string().nullish(),
    brandId: z.string().uuid().nullish(),
  });
  const parsed = QuerySchema.parse({ start, end, brandId });

  // First, get user's posts filtered by brand (if provided)
  // This ensures we only get scheduled posts for the correct brand
  let postsQuery = supabase
    .from('posts')
    .select('id, brand_id')
    .eq('user_id', user.id);

  // Filter by brand if provided
  if (parsed.brandId) {
    postsQuery = postsQuery.eq('brand_id', parsed.brandId);
  }

  const { data: userPosts, error: postsError } = await postsQuery;

  if (postsError) {
    console.error('Error fetching user posts:', postsError);
  }

  let dbPosts: any[] = [];
  if (userPosts && userPosts.length > 0) {
    const postIds = userPosts.map(p => p.id);

    // Get full post details with brand info
    const { data: postsWithDetails, error: postsDetailsError } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        platforms,
        brand_id,
        created_at,
        status,
        getlate_post_id,
        metadata,
        brands (
          id,
          name,
          logo_url
        )
      `)
      .in('id', postIds);

    if (postsDetailsError) {
      console.error('Error fetching post details:', postsDetailsError);
    }

    // Now get scheduled posts for these filtered posts
    // Include both pending scheduled posts and published posts
    const { data: scheduledPostsData, error: scheduledError } = await supabase
      .from('scheduled_posts')
      .select(`
        id,
        post_id,
        scheduled_for,
        published_at,
        timezone,
        status
      `)
      .in('post_id', postIds)
      .in('status', ['pending', 'completed', 'published']);

    if (scheduledError) {
      console.error('Error fetching scheduled posts:', scheduledError);
    }

    // Group all scheduled_post rows per post (multi-platform). Dashboard-style: use latest publish time.
    const scheduledPostsByPostId = new Map<string, any[]>();
    for (const sp of scheduledPostsData || []) {
      const list = scheduledPostsByPostId.get(sp.post_id) || [];
      list.push(sp);
      scheduledPostsByPostId.set(sp.post_id, list);
    }

    // Create a map of post_id -> post details
    const postsMap = new Map<string, any>();
    (postsWithDetails || []).forEach((p: any) => {
      postsMap.set(p.id, p);
    });

    // Combine posts with their scheduled_post data
    // Include posts that have scheduled_posts entries OR posts that should appear on calendar
    const allCombinedPosts: any[] = [];

    for (const postId of postIds) {
      const postDetails = postsMap.get(postId);
      const scheduledRows = scheduledPostsByPostId.get(postId) || [];
      const scheduledPost = scheduledRows.length > 0
        ? scheduledRows.reduce((best, sp) => {
            const bestT = maxValidDate([best.published_at, best.scheduled_for])?.getTime() ?? 0;
            const spT = maxValidDate([sp.published_at, sp.scheduled_for])?.getTime() ?? 0;
            return spT >= bestT ? sp : best;
          })
        : null;

      if (!postDetails) {
        continue;
      }

      const maxPublishedAt = maxValidDate(scheduledRows.map((s: any) => s.published_at));
      const maxScheduledFor = maxValidDate(scheduledRows.map((s: any) => s.scheduled_for));
      const anyRowPublished = scheduledRows.some(
        (s: any) =>
          !!s.published_at
          || s.status === 'published'
          || s.status === 'completed',
      );
      const postIsPublished
        = postDetails.status === 'published' || anyRowPublished;

      // Last published instant across platforms; if not published yet, latest planned schedule (matches dashboard intent)
      const displayDate
        = postIsPublished && maxPublishedAt
          ? maxPublishedAt
          : (maxScheduledFor
            || maxValidDate(scheduledRows.flatMap((s: any) => [s.published_at, s.scheduled_for]))
            || postDetails.created_at);

      if (!displayDate) {
        continue;
      }

      const date = new Date(displayDate);
      const startDate = parsed.start ? new Date(parsed.start) : null;
      const endDate = parsed.end ? new Date(parsed.end) : null;

      // Check date range
      // If post has scheduled_post entry, enforce date range strictly
      // If post doesn't have scheduled_post entry, be very lenient (include if within 1 year of range)
      if (scheduledPost) {
        // Strict date filtering for scheduled posts
        if (startDate && date < startDate) {
          continue;
        }
        if (endDate && date > endDate) {
          continue;
        }
      } else {
        // Very lenient filtering for posts without scheduled_posts entries
        // Include posts within the date range OR within 1 year before/after
        // This ensures posts without scheduled_posts entries still show up
        if (startDate && endDate) {
          const oneYearBefore = new Date(startDate);
          oneYearBefore.setFullYear(oneYearBefore.getFullYear() - 1);
          const oneYearAfter = new Date(endDate);
          oneYearAfter.setFullYear(oneYearAfter.getFullYear() + 1);

          if (date < oneYearBefore || date > oneYearAfter) {
            continue;
          }
        }
      }

      // Preserve platform objects with URLs - don't normalize to strings
      // This allows the frontend to extract platformPostUrl for each platform
      const rawPlatforms = postDetails.platforms || [];
      const preservedPlatforms = rawPlatforms.map((p: any) => {
        if (typeof p === 'string') {
          return p;
        }
        if (typeof p === 'object' && p !== null) {
          // Preserve the full object to keep platformPostUrl
          return p;
        }
        return String(p);
      });

      // Build the combined post object
      const combinedPost = {
        id: scheduledPost?.id || `post-${postId}`,
        post_id: postId,
        scheduled_for: displayDate,
        scheduled_time: displayDate,
        published_at: maxPublishedAt ? maxPublishedAt.toISOString() : (scheduledPost?.published_at || null),
        timezone: scheduledPost?.timezone || null,
        status: scheduledPost?.status || postDetails.status || 'draft',
        post: {
          id: postId,
          content: postDetails.content,
          image_url: postDetails.image_url,
          platforms: preservedPlatforms, // Preserve full objects to keep URLs
          brand_id: postDetails.brand_id,
          getlate_post_id: postDetails.getlate_post_id || null,
          metadata: postDetails.metadata || null,
          brands: postDetails.brands
            ? {
                id: postDetails.brands.id,
                name: postDetails.brands.name,
                logo_url: postDetails.brands.logo_url,
              }
            : null,
        },
      };

      allCombinedPosts.push(combinedPost);
    }

    // Filter by brand if provided
    const filteredData = allCombinedPosts.filter((item: any) => {
      if (parsed.brandId) {
        const postBrandId = item.post?.brand_id;
        if (!postBrandId || postBrandId !== parsed.brandId) {
          return false;
        }
      }
      return true;
    });

    dbPosts = filteredData.sort((a, b) => {
      const dateA = new Date(a.scheduled_for || 0).getTime();
      const dateB = new Date(b.scheduled_for || 0).getTime();
      return dateA - dateB;
    });
  }

  // Fetch posts from Publishing integration API
  const getlatePosts: any[] = [];
  try {
    // Get user's Publishing integration API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userRecord?.getlate_api_key) {
      const getlateClient = createGetlateClient(userRecord.getlate_api_key);

      // Get user's brands with Publishing integration profile IDs
      let brandsQuery = supabase
        .from('brands')
        .select('id, getlate_profile_id')
        .eq('user_id', user.id);

      if (parsed.brandId) {
        brandsQuery = brandsQuery.eq('id', parsed.brandId);
      }

      const { data: brands } = await brandsQuery;

      if (brands && brands.length > 0) {
        // Fetch posts from Publishing integration for each profile
        for (const brand of brands) {
          if (brand.getlate_profile_id) {
            try {
              const allPosts = await getlateClient.getPosts({
                profileId: brand.getlate_profile_id,
              });

              // Filter posts by date range and transform to calendar format
              // Include both scheduled and published posts
              for (let index = 0; index < allPosts.length; index++) {
                const post = allPosts[index];
                if (!post) {
                  continue;
                }

                // Handle different ID formats (id, _id, or generate one using index)
                const postId = (post as any).id || (post as any)._id || `temp-${brand.getlate_profile_id}-${index}`;

                const postWithPublished = post as GetlatePost & { publishedAt?: string };
                // Match dashboard Posts table: publishedAt || scheduledFor (actual publish beats original schedule)
                const publishedAtStr
                  = post.status === 'published'
                    ? (postWithPublished.publishedAt || post.scheduledFor || post.createdAt)
                    : null;
                const displayDateStr = publishedAtStr || post.scheduledFor || post.createdAt;
                const displayInstant = displayDateStr ? new Date(displayDateStr) : null;

                if (displayInstant && !Number.isNaN(displayInstant.getTime())) {
                  const startDate = parsed.start ? new Date(parsed.start) : null;
                  const endDate = parsed.end ? new Date(parsed.end) : null;

                  // Check if post is within date range (by canonical display date, not original schedule only)
                  if (
                    (!startDate || displayInstant >= startDate)
                    && (!endDate || displayInstant <= endDate)
                  ) {
                    // Get brand info for Publishing integration posts
                    const { data: brandInfo } = await supabase
                      .from('brands')
                      .select('id, name, logo_url')
                      .eq('id', brand.id)
                      .single();

                    const publishedAt = publishedAtStr;
                    const displayDate = displayDateStr;

                    const uniqueId = `getlate-${brand.id}-${postId}-${index}`;

                    // Extract platformPostUrl from post or platforms array
                    // Note: API response may include extra fields beyond the typed post shape
                    const postWithExtras = post as GetlatePost & {
                      platformPostUrl?: string;
                      metadata?: Record<string, unknown>;
                      isExternal?: boolean;
                    };

                    let platformPostUrl: string | null = null;
                    if (postWithExtras.platformPostUrl) {
                      platformPostUrl = postWithExtras.platformPostUrl;
                    } else if (post.platforms && Array.isArray(post.platforms)) {
                      for (const platform of post.platforms) {
                        const platformWithExtras = platform as typeof platform & {
                          platformPostUrl?: string;
                        };
                        if (typeof platformWithExtras === 'object' && platformWithExtras?.platformPostUrl) {
                          platformPostUrl = platformWithExtras.platformPostUrl;
                          break;
                        }
                      }
                    }

                    // Build metadata object
                    const metadata = {
                      ...(postWithExtras.metadata || {}),
                      platformPostUrl: platformPostUrl || (postWithExtras.metadata as any)?.platformPostUrl || null,
                      isExternal: postWithExtras.isExternal || false,
                      publishedAt: publishedAt || undefined,
                    };

                    // Preserve platform objects with URLs for Publishing integration posts
                    const preservedGetlatePlatforms = post.platforms?.map((p: any) => {
                      if (typeof p === 'string') {
                        return p;
                      }
                      if (typeof p === 'object' && p !== null) {
                        // Preserve the full object to keep platformPostUrl
                        return p;
                      }
                      return 'unknown';
                    }) || [];

                    getlatePosts.push({
                      id: uniqueId,
                      post_id: uniqueId,
                      scheduled_for: displayDate,
                      scheduled_time: displayDate,
                      published_at: publishedAt,
                      timezone: post.timezone,
                      status: post.status === 'published' ? 'completed' : 'pending',
                      post: {
                        id: uniqueId,
                        content: post.content,
                        image_url: post.mediaUrls?.[0] || null,
                        platforms: preservedGetlatePlatforms, // Preserve full objects to keep URLs
                        brand_id: brand.id,
                        brands: brandInfo
                          ? {
                              id: brandInfo.id,
                              name: brandInfo.name,
                              logo_url: brandInfo.logo_url,
                            }
                          : null,
                        getlate_post_id: postId,
                        metadata,
                      },
                      is_getlate: true,
                    });
                  }
                }
              }
            } catch {
              // Silently fail for individual profile errors
            }
          }
        }
      }
    }
  } catch {
    // Silently fail if Publishing integration fetch fails
  }

  // Merge database posts and Publishing integration posts
  // Deduplicate: when a post has a provider post id, prefer the API copy (source of truth)
  // Map provider post id -> post for posts that originated from the publishing API
  const getlatePostIdMap = new Map<string, any>();
  const processedGetlateIds = new Set<string>(); // Global set to handle profile sharing across brands

  const uniqueGetlatePosts = getlatePosts.filter((post: any) => {
    const getlateId = post.post?.getlate_post_id;
    if (getlateId) {
      if (processedGetlateIds.has(getlateId)) {
        return false; // Already processed this Publishing integration post via another brand
      }
      processedGetlateIds.add(getlateId);
      getlatePostIdMap.set(getlateId, post);
    }
    return true;
  });

  // Filter out database posts that have a corresponding Publishing integration post
  const filteredDbPosts = dbPosts.filter((dbPost: any) => {
    const dbGetlateId = dbPost.post?.getlate_post_id;
    // If this DB row links to a provider post we already merged from the API, exclude the duplicate
    if (dbGetlateId && getlatePostIdMap.has(dbGetlateId)) {
      return false;
    }
    return true;
  });

  // Merge filtered database posts with unique Publishing integration posts
  let allPosts = [...filteredDbPosts, ...uniqueGetlatePosts];

  // Prefer newer display time when deduplicating so DB + API copies collapse to the latest publish date
  allPosts.sort((a: any, b: any) => {
    const tb = new Date(b.scheduled_for || b.scheduled_time || 0).getTime();
    const ta = new Date(a.scheduled_for || a.scheduled_time || 0).getTime();
    return tb - ta;
  });

  // Additional robust deduplication:
  // 1. By internal ID (legacy/fallback)
  // 2. By content snippet + scheduled time (catches cross-source duplicates with different IDs)
  const seenIds = new Set<string>();
  const seenContentTime = new Set<string>();

  allPosts = allPosts.filter((post: any) => {
    const postId = post.post_id || post.post?.id;
    const scheduledTime = post.scheduled_for || post.scheduled_time;
    const contentHash = (post.post?.content || '').substring(0, 50).trim();

    // Normalize time to minutes to avoid slight millisecond differences
    const timeDate = new Date(scheduledTime);
    const normalizedTime = timeDate instanceof Date && !Number.isNaN(timeDate.getTime())
      ? timeDate.toISOString().substring(0, 16) // "2026-03-21T14:00"
      : scheduledTime;

    const idKey = `${postId}`;
    const contentTimeKey = `${contentHash}-${normalizedTime}`;

    if (seenIds.has(idKey)) {
      return false;
    }

    // If we've seen this exact content at the exact same time, it's a duplicate
    // even if the IDs are different (e.g. from different sources)
    if (contentHash && normalizedTime && seenContentTime.has(contentTimeKey)) {
      return false;
    }

    seenIds.add(idKey);
    if (contentHash && normalizedTime) {
      seenContentTime.add(contentTimeKey);
    }
    return true;
  });

  // Final brand filter to ensure consistency (in case any posts slipped through)
  if (parsed.brandId) {
    allPosts = allPosts.filter((item: any) => {
      const postBrandId = item.post?.brand_id || item.posts?.brand_id;
      return postBrandId === parsed.brandId;
    });
  }

  // Sort by scheduled_for date
  allPosts.sort((a, b) => {
    const dateA = new Date(a.scheduled_for || a.scheduled_time || 0).getTime();
    const dateB = new Date(b.scheduled_for || b.scheduled_time || 0).getTime();
    return dateA - dateB;
  });

  return NextResponse.json({ data: allPosts });
}
