import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * GET /api/scheduled-posts
 * Get scheduled posts within a date range
 * Includes posts from both database and Getlate API
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

    // Create a map of post_id -> scheduled_post data
    const scheduledPostsMap = new Map<string, any>();
    (scheduledPostsData || []).forEach((sp: any) => {
      scheduledPostsMap.set(sp.post_id, sp);
    });

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
      const scheduledPost = scheduledPostsMap.get(postId);

      if (!postDetails) {
        continue;
      }

      // Use scheduled_post data if available, otherwise use post created_at
      const displayDate = scheduledPost?.published_at
        || scheduledPost?.scheduled_for
        || postDetails.created_at;

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

      // Normalize platforms array - handle both string and object formats
      const normalizedPlatforms = (postDetails.platforms || []).map((p: any) => {
        if (typeof p === 'string') {
          return p;
        }
        if (typeof p === 'object' && p !== null) {
          // Handle object format: {platform: 'instagram', account_id: '...'}
          return p.platform || p.name || String(p);
        }
        return String(p);
      }).filter((p: any) => p && typeof p === 'string');

      // Build the combined post object
      const combinedPost = {
        id: scheduledPost?.id || `post-${postId}`,
        post_id: postId,
        scheduled_for: displayDate,
        scheduled_time: displayDate,
        published_at: scheduledPost?.published_at || null,
        timezone: scheduledPost?.timezone || null,
        status: scheduledPost?.status || postDetails.status || 'draft',
        post: {
          id: postId,
          content: postDetails.content,
          image_url: postDetails.image_url,
          platforms: normalizedPlatforms,
          brand_id: postDetails.brand_id,
          getlate_post_id: postDetails.getlate_post_id || null,
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

  // Fetch posts from Getlate API
  const getlatePosts: any[] = [];
  try {
    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userRecord?.getlate_api_key) {
      const getlateClient = createGetlateClient(userRecord.getlate_api_key);

      // Get user's brands with Getlate profile IDs
      let brandsQuery = supabase
        .from('brands')
        .select('id, getlate_profile_id')
        .eq('user_id', user.id);

      if (parsed.brandId) {
        brandsQuery = brandsQuery.eq('id', parsed.brandId);
      }

      const { data: brands } = await brandsQuery;

      if (brands && brands.length > 0) {
        // Fetch posts from Getlate for each profile
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

                // Check if post has a scheduled date (scheduled or published posts)
                // Include all statuses: scheduled, published, draft (if they have dates)
                const scheduledDate = post.scheduledFor
                  ? new Date(post.scheduledFor)
                  : (post.createdAt ? new Date(post.createdAt) : null);

                if (scheduledDate) {
                  const startDate = parsed.start ? new Date(parsed.start) : null;
                  const endDate = parsed.end ? new Date(parsed.end) : null;

                  // Check if post is within date range
                  if (
                    (!startDate || scheduledDate >= startDate)
                    && (!endDate || scheduledDate <= endDate)
                  ) {
                    // Get brand info for Getlate posts
                    const { data: brandInfo } = await supabase
                      .from('brands')
                      .select('id, name, logo_url')
                      .eq('id', brand.id)
                      .single();

                    // Transform Getlate post to calendar format
                    // Determine published_at: if published, use scheduledFor or createdAt
                    const publishedAt = post.status === 'published' ? (post.scheduledFor || post.createdAt) : null;
                    // Use published_at if available, otherwise scheduled_for for display
                    const displayDate = publishedAt || post.scheduledFor || post.createdAt;

                    const uniqueId = `getlate-${brand.id}-${postId}-${index}`;
                    getlatePosts.push({
                      id: uniqueId,
                      post_id: uniqueId,
                      scheduled_for: post.scheduledFor || post.createdAt,
                      scheduled_time: displayDate, // Prioritize published_at for display
                      published_at: publishedAt,
                      timezone: post.timezone,
                      status: post.status === 'published' ? 'completed' : 'pending',
                      post: {
                        id: uniqueId,
                        content: post.content,
                        image_url: post.mediaUrls?.[0] || null,
                        platforms: post.platforms?.map((p: any) => {
                          // Handle both string and object formats
                          return typeof p === 'string' ? p : (p.platform || p.name || 'unknown');
                        }) || [],
                        brand_id: brand.id,
                        brands: brandInfo
                          ? {
                              id: brandInfo.id,
                              name: brandInfo.name,
                              logo_url: brandInfo.logo_url,
                            }
                          : null,
                        getlate_post_id: postId,
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
    // Silently fail if Getlate fetch fails
  }

  // Merge database posts and Getlate posts
  // Deduplicate: if a post has getlate_post_id, prefer Getlate version (source of truth)
  // Create a map of getlate_post_id -> post to track Getlate posts
  const getlatePostIdMap = new Map<string, any>();
  getlatePosts.forEach((post: any) => {
    const getlateId = post.post?.getlate_post_id;
    if (getlateId) {
      getlatePostIdMap.set(getlateId, post);
    }
  });

  // Filter out database posts that have a corresponding Getlate post
  const filteredDbPosts = dbPosts.filter((dbPost: any) => {
    const dbGetlateId = dbPost.post?.getlate_post_id;
    // If this database post has a getlate_post_id and we have it from Getlate API, exclude it
    if (dbGetlateId && getlatePostIdMap.has(dbGetlateId)) {
      return false;
    }
    return true;
  });

  // Merge filtered database posts with Getlate posts
  let allPosts = [...filteredDbPosts, ...getlatePosts];

  // Additional deduplication: remove duplicates based on post_id + scheduled_time combination
  // This handles cases where the same post might appear multiple times with the same scheduled time
  const seenPosts = new Map<string, boolean>();
  allPosts = allPosts.filter((post: any) => {
    const postId = post.post_id || post.post?.id;
    const scheduledTime = post.scheduled_for || post.scheduled_time;
    const dedupeKey = `${postId}-${scheduledTime}`;

    if (seenPosts.has(dedupeKey)) {
      return false; // Duplicate, exclude it
    }
    seenPosts.set(dedupeKey, true);
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
