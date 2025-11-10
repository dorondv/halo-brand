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

  // Build query for scheduled posts from database
  // Include both pending scheduled posts and published posts
  let query = supabase
    .from('scheduled_posts')
    .select(`
      id,
      post_id,
      scheduled_for,
      published_at,
      timezone,
      status,
      posts (
        id,
        content,
        image_url,
        platforms,
        brand_id
      )
    `)
    .in('status', ['pending', 'completed', 'published']);

  // Filter by brand if provided
  if (parsed.brandId) {
    query = query.eq('posts.brand_id', parsed.brandId);
  }

  // Also filter by user's posts
  const { data: userPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', user.id);

  let dbPosts: any[] = [];
  if (userPosts && userPosts.length > 0) {
    const postIds = userPosts.map(p => p.id);
    query = query.in('post_id', postIds);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching scheduled posts:', error);
    } else {
      // Filter by date range in memory (check both scheduled_for and published_at)
      const filteredData = (data || []).filter((item: any) => {
        const displayDate = item.published_at || item.scheduled_for;
        if (!displayDate) {
          return false;
        }

        const date = new Date(displayDate);
        const startDate = parsed.start ? new Date(parsed.start) : null;
        const endDate = parsed.end ? new Date(parsed.end) : null;

        if (startDate && date < startDate) {
          return false;
        }
        if (endDate && date > endDate) {
          return false;
        }

        return true;
      });

      dbPosts = filteredData.map((item: any) => {
        // Use published_at if available, otherwise use scheduled_for
        const displayDate = item.published_at || item.scheduled_for;
        return {
          ...item,
          scheduled_for: displayDate,
          scheduled_time: displayDate,
        };
      }).sort((a, b) => {
        const dateA = new Date(a.scheduled_for || 0).getTime();
        const dateB = new Date(b.scheduled_for || 0).getTime();
        return dateA - dateB;
      });
    }
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
                    // Transform Getlate post to calendar format
                    const uniqueId = `getlate-${brand.id}-${postId}-${index}`;
                    getlatePosts.push({
                      id: uniqueId,
                      post_id: uniqueId,
                      scheduled_for: post.scheduledFor || post.createdAt,
                      scheduled_time: post.scheduledFor || post.createdAt,
                      published_at: post.status === 'published' ? (post.scheduledFor || post.createdAt) : null,
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
  const allPosts = [...dbPosts, ...getlatePosts];

  // Sort by scheduled_for date
  allPosts.sort((a, b) => {
    const dateA = new Date(a.scheduled_for || a.scheduled_time || 0).getTime();
    const dateB = new Date(b.scheduled_for || b.scheduled_time || 0).getTime();
    return dateA - dateB;
  });

  return NextResponse.json({ data: allPosts });
}
