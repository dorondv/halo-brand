import type { GetlatePlatform } from '@/libs/Getlate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncAnalyticsFromGetlate } from '@/libs/analytics-sync';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { collectPostPayloadMediaUrls, isAllowedOptionalPostMediaUrl } from '@/libs/supabaseStorageUrl';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('posts')
    .select('id,user_id,content,image_url,ai_caption,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  // require authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const PostSchema = z.object({
    content: z.string().min(1).max(5000),
    image_url: z.string().nullable().optional(),
    ai_caption: z.string().nullable().optional(),
    hashtags: z.array(z.string()).optional(),
    media_type: z.string().optional(),
    metadata: z.any().optional(), // Can contain media_urls array
    brand_id: z.string().uuid().optional(),
    scheduled_for: z.string().optional(), // ISO timestamp
    timezone: z.string().optional(), // IANA timezone
    platforms: z.array(z.object({
      platform: z.string(),
      account_id: z.string().uuid(),
      config: z.any().optional(),
    })).optional(),
    use_getlate: z.boolean().optional().default(false), // Whether to use Publishing integration API
  });

  const parse = PostSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.message }, { status: 422 });
  }

  const payload = parse.data;

  // Treat empty/whitespace scheduled_for as absent so Getlate never receives scheduledFor: ""
  // together with publishNow: true (that combination can cause duplicate publishes).
  const scheduledForIso
    = typeof payload.scheduled_for === 'string' && payload.scheduled_for.trim() !== ''
      ? payload.scheduled_for.trim()
      : undefined;

  if (scheduledForIso) {
    const scheduledDate = new Date(scheduledForIso);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled_for datetime' }, { status: 422 });
    }
  }

  const postMediaUrls = collectPostPayloadMediaUrls(payload);
  const invalidMediaUrl = postMediaUrls.find(u => !isAllowedOptionalPostMediaUrl(u));
  if (invalidMediaUrl) {
    return NextResponse.json(
      { error: 'All post media must be uploaded to Supabase Storage (post-media) before creating a post.' },
      { status: 422 },
    );
  }

  // If using Publishing integration, create post via Publishing integration API
  let getlatePostId: string | null = null;
  let getlatePlatforms: any[] | null = null;

  if (payload.use_getlate && payload.brand_id) {
    try {
      // Get user's Publishing integration API key
      const { data: userRecord } = await supabase
        .from('users')
        .select('getlate_api_key')
        .eq('id', user.id)
        .single();

      if (userRecord?.getlate_api_key) {
        // Get brand's Publishing integration profile ID
        const { data: brandRecord } = await supabase
          .from('brands')
          .select('getlate_profile_id')
          .eq('id', payload.brand_id)
          .eq('user_id', user.id)
          .single();

        if (brandRecord?.getlate_profile_id) {
          const getlateClient = createGetlateClient(userRecord.getlate_api_key);

          // Map platforms to Publishing integration format
          // The account_id in payload.platforms might be either:
          // 1. Local database ID (if not using Publishing integration)
          // 2. Publishing integration account ID (if already mapped by frontend)
          // We need to fetch social accounts to resolve provider account ids for local row IDs
          const accountIds = (payload.platforms || []).map(p => p.account_id);
          const { data: socialAccounts } = await supabase
            .from('social_accounts')
            .select('id, getlate_account_id, platform')
            .in('id', accountIds)
            .eq('brand_id', payload.brand_id);

          // Also check if any account_ids are already provider-side account ids
          const { data: accountsByGetlateId } = await supabase
            .from('social_accounts')
            .select('id, getlate_account_id, platform')
            .in('getlate_account_id', accountIds)
            .eq('brand_id', payload.brand_id);

          // Maps: local row id -> provider account id, and provider id -> provider id (for direct matches)
          const localIdToGetlateMap = new Map(
            socialAccounts?.map(acc => [acc.id, acc.getlate_account_id]) || [],
          );
          const getlateIdMap = new Map(
            accountsByGetlateId?.map(acc => [acc.getlate_account_id, acc.getlate_account_id]) || [],
          );

          // Extract all media URLs from metadata or use image_url
          // Support both metadata.media_urls array and single image_url
          const rawMediaUrls = payload.metadata?.media_urls && Array.isArray(payload.metadata.media_urls) && payload.metadata.media_urls.length > 0
            ? payload.metadata.media_urls
            : (payload.image_url ? [payload.image_url] : []);

          // Upload media to Publishing integration first (required for proper media handling)
          // This downloads from Supabase Storage URLs and uploads to Publishing integration's media endpoint
          let mediaItems: Array<{ type: 'image' | 'video'; url: string }> | undefined;
          if (rawMediaUrls.length > 0) {
            try {
              // Upload media to Publishing integration and get their URLs
              const uploadedUrls = await getlateClient.uploadMediaFromUrls(rawMediaUrls);

              // Convert to mediaItems format (required by Publishing integration API)
              mediaItems = uploadedUrls.map((url: string) => {
                // Determine type from URL
                const urlLower = url.toLowerCase();
                const isVideo = urlLower.includes('.mp4') || urlLower.includes('.mov')
                  || urlLower.includes('.avi') || urlLower.includes('.webm')
                  || urlLower.includes('.m4v') || urlLower.includes('video');

                return {
                  type: (isVideo ? 'video' : 'image') as 'image' | 'video',
                  url,
                };
              });
            } catch {
              // Fallback to original URLs in mediaItems format
              mediaItems = rawMediaUrls.map((url: string) => {
                const urlLower = url.toLowerCase();
                const isVideo = urlLower.includes('.mp4') || urlLower.includes('.mov')
                  || urlLower.includes('.avi') || urlLower.includes('.webm')
                  || urlLower.includes('.m4v') || urlLower.includes('video');

                return {
                  type: (isVideo ? 'video' : 'image') as 'image' | 'video',
                  url,
                };
              });
              console.warn('[Posts API] Using fallback mediaItems (original URLs):', mediaItems);
            }
          }

          // Map platforms to Publishing integration format with proper account IDs
          // IMPORTANT: Deduplicate platforms to prevent multiple posts for the same platform
          // Publishing integration API should only have one entry per platform per post
          const seenPlatforms = new Set<string>();
          const getlatePlatformsArray = (payload.platforms || [])
            .map((p) => {
              // Check if account_id is already a provider account id or needs lookup
              const getlateAccountId = getlateIdMap.get(p.account_id)
                || localIdToGetlateMap.get(p.account_id);

              // If we could not resolve a provider account id, the account may not be connected
              if (!getlateAccountId) {
                return null;
              }

              const platform = (p.platform === 'x' ? 'twitter' : p.platform) as GetlatePlatform;

              // Deduplicate: if we've already seen this platform, skip it to prevent duplicate posts
              // Use platform + accountId as the unique key to allow different accounts of the same platform
              // But if same platform appears multiple times with different accountIds, we should only use the first one
              const platformKey = platform; // Use platform as key to ensure only one entry per platform
              if (seenPlatforms.has(platformKey)) {
                // Platform already processed - skip to prevent duplicate posts
                return null;
              }
              seenPlatforms.add(platformKey);

              // Start with platform-specific config from frontend
              const platformSpecificData: Record<string, unknown> = { ...(p.config || {}) };

              // Handle platform-specific mediaItems
              // If platform has specific mediaItems in config, use those; otherwise use shared mediaItems
              const platformMediaItems = platformSpecificData.mediaItems as Array<{ type: 'image' | 'video'; url: string }> | undefined;
              if (platformMediaItems && platformMediaItems.length > 0) {
                // Platform has specific media - use it
                platformSpecificData.mediaItems = platformMediaItems;
              } else if (mediaItems && mediaItems.length > 0) {
                // Use shared mediaItems for this platform
                // Some platforms (like Facebook) may need mediaItems in platformSpecificData
                if (platform === 'facebook' || platform === 'instagram' || platform === 'threads') {
                  platformSpecificData.mediaItems = mediaItems;
                }
              }

              // Handle platform-specific content
              // If platform has specific content in config, it's already in platformSpecificData.content
              // Otherwise, shared content (payload.content) will be used at root level
              // Note: Don't set platformSpecificData.content to shared content - let Publishing integration use root level content

              // Ensure format is set if provided
              if (platformSpecificData.format) {
                // Format is already set from config
              }

              // Ensure firstComment is included if provided
              if (platformSpecificData.firstComment) {
                // firstComment is already set from config
              }

              // Ensure platform-specific hashtags are included if provided
              if (platformSpecificData.hashtags && Array.isArray(platformSpecificData.hashtags)) {
                // Hashtags are already set from config
              }

              // Ensure platform-specific title is included if provided (for YouTube, LinkedIn)
              if (platformSpecificData.title) {
                // Title is already set from config
              }

              return {
                platform,
                accountId: getlateAccountId, // Publishing integration API expects accountId (camelCase)
                platformSpecificData: Object.keys(platformSpecificData).length > 0 ? platformSpecificData : undefined,
              };
            })
            .filter(Boolean) as Array<{
            platform: GetlatePlatform;
            accountId: string;
            platformSpecificData?: Record<string, unknown>;
          }>;

          // If no valid Publishing integration accounts found, skip Publishing integration integration
          if (getlatePlatformsArray.length === 0) {
            // Continue with local post creation
          } else {
          // Extract title from platform-specific data if available (for YouTube, LinkedIn)
          // Check if any platform has a title in platformSpecificData
            let sharedTitle: string | undefined;
            const platformsWithTitle = getlatePlatformsArray.filter(p =>
              p.platformSpecificData?.title && typeof p.platformSpecificData.title === 'string',
            );
            // If YouTube or LinkedIn have titles, use the first one as shared title
            if (platformsWithTitle.length > 0) {
              const youtubeOrLinkedIn = platformsWithTitle.find(p =>
                p.platform === 'youtube' || p.platform === 'linkedin',
              );
              if (youtubeOrLinkedIn?.platformSpecificData?.title) {
                sharedTitle = youtubeOrLinkedIn.platformSpecificData.title as string;
              } else {
              // Use first available title
                sharedTitle = platformsWithTitle[0]?.platformSpecificData?.title as string;
              }
            }
            // Fallback: Check metadata.platform_content for title (if not found in platformSpecificData)
            if (!sharedTitle && payload.metadata?.platform_content) {
              const platformContent = payload.metadata.platform_content as Record<string, { title?: string }>;
              const firstPlatformWithTitle = Object.values(platformContent).find((pc: any) => pc?.title);
              if (firstPlatformWithTitle?.title) {
                sharedTitle = firstPlatformWithTitle.title;
              }
            }

            // Create post in Publishing integration
            // According to Publishing integration API docs: content and mediaItems are shared at root level
            // Platform-specific content goes in platformSpecificData.content for each platform
            // Title can be at root level (for YouTube, LinkedIn) or in platformSpecificData
            // Use mediaItems format (required by Publishing integration API for proper media handling)
            // Set publishNow to true if not scheduled (for immediate publishing)

            // Ensure LinkedIn and YouTube have title in platformSpecificData if title exists
            // Some platforms require title in platformSpecificData, not just root level
            // Also ensure LinkedIn has proper content structure and media handling
            getlatePlatformsArray.forEach((platform) => {
              if (platform.platform === 'linkedin' || platform.platform === 'youtube') {
                if (!platform.platformSpecificData) {
                  platform.platformSpecificData = {};
                }

                // Ensure title is in platformSpecificData for LinkedIn/YouTube
                if (sharedTitle && !platform.platformSpecificData.title) {
                  platform.platformSpecificData.title = sharedTitle;
                }

                // LinkedIn-specific: Handle media items properly
                // LinkedIn supports up to 20 images, single video, or single PDF
                // LinkedIn doesn't support mixing media types in a single post
                if (platform.platform === 'linkedin') {
                  // Get mediaItems from platformSpecificData or use shared mediaItems
                  const platformMediaItems = platform.platformSpecificData.mediaItems as Array<{ type: string; url: string }> | undefined;
                  const finalMediaItems = platformMediaItems || mediaItems;

                  if (finalMediaItems && finalMediaItems.length > 0) {
                    const hasImages = finalMediaItems.some(m => m.type === 'image');
                    const hasVideos = finalMediaItems.some(m => m.type === 'video');

                    // If mixing media types, prefer images (more reliable for LinkedIn)
                    if (hasImages && hasVideos) {
                      const imageItems = finalMediaItems.filter(m => m.type === 'image');
                      platform.platformSpecificData.mediaItems = imageItems;
                    } else {
                      // Ensure mediaItems are set in platformSpecificData for LinkedIn
                      platform.platformSpecificData.mediaItems = finalMediaItems;
                    }

                    // LinkedIn has a limit of 20 images
                    if (hasImages && finalMediaItems.length > 20) {
                      platform.platformSpecificData.mediaItems = finalMediaItems.slice(0, 20);
                    }
                  }

                  // LinkedIn: Ensure content is set if platform-specific content exists
                  // If no platform-specific content, LinkedIn will use root-level content
                  if (platform.platformSpecificData.content) {
                    // Platform-specific content is already set
                  } else if (payload.content) {
                    // For LinkedIn, ensure content is available (will use root-level)
                  }
                }
              }
            });

            const getlatePost = await getlateClient.createPost({
              profileId: brandRecord.getlate_profile_id,
              content: payload.content, // Shared content (platform-specific content is in platformSpecificData)
              title: sharedTitle, // Optional title (for YouTube, LinkedIn) - also in platformSpecificData
              // Send mediaItems at root level (Publishing integration API format)
              // Platform-specific mediaItems are in platformSpecificData.mediaItems
              mediaItems,
              ...(scheduledForIso ? { scheduledFor: scheduledForIso } : {}),
              timezone: payload.timezone,
              platforms: getlatePlatformsArray,
              // Add hashtags if provided
              hashtags: payload.hashtags,
              // Publish immediately if not scheduled
              // Note: Publishing integration API publishes asynchronously - the post is created immediately
              // but publishing to social platforms happens in the background
              publishNow: !scheduledForIso,
            });

            getlatePostId = getlatePost.id || (getlatePost as any)._id;
            getlatePlatforms = getlatePost.platforms;

            // Check post status - Publishing integration API returns immediately but publishing is async
            // Status can be: 'draft', 'scheduled', 'published', or 'failed'
            // If status is 'failed', it means Publishing integration's internal retry mechanism exhausted
            // However, the post was still created in Publishing integration and may be retried later
            if (getlatePost.status === 'failed') {
              console.warn('[Getlate Post Creation] Post created in Getlate but publishing failed:', {
                getlatePostId,
                platforms: getlatePlatformsArray.map(p => p.platform),
                status: getlatePost.status,
                note: 'Post exists in Getlate but may not be published yet. Check Getlate dashboard for details.',
              });
              // Continue with local post creation - the post exists in Publishing integration
              // User can retry publishing from Publishing integration dashboard if needed
            } else if (!scheduledForIso && getlatePost.status !== 'published') {
              // For immediate publishing, if status is not 'published', it's still processing
              console.warn('[Getlate Post Creation] Post created, publishing in progress:', {
                getlatePostId,
                status: getlatePost.status,
                note: 'Publishing happens asynchronously. Status will update once complete.',
              });
            }
          }
        }
      }
    } catch (error: any) {
      // Log the error for debugging
      const errorMessage = error?.message || String(error);

      // Check if this is a publishing timeout/retry error from Publishing integration API
      // These errors occur when Publishing integration's async publishing fails, but the post may still exist
      const isPublishingError = errorMessage.includes('timeout')
        || errorMessage.includes('max retries')
        || errorMessage.includes('Publishing failed');

      if (isPublishingError) {
        // This is a publishing error - the post may have been created in Publishing integration
        // but publishing to social platforms failed
        console.warn('[Getlate Post Creation] Publishing error (post may still exist in Getlate):', {
          error: errorMessage,
          brandId: payload.brand_id,
          platforms: payload.platforms?.map(p => p.platform),
          note: 'The post may have been created in Getlate but publishing failed. Check Getlate dashboard to verify post status and retry if needed.',
        });
        // Continue with local post creation - user can check Publishing integration dashboard for post status
      } else {
        // This is a different error (API failure, network issue, etc.)
        console.error('[Getlate Post Creation] Error creating post via Getlate API:', {
          error: errorMessage,
          stack: error?.stack,
          brandId: payload.brand_id,
          platforms: payload.platforms?.map(p => p.platform),
        });
      }

      // Continue with local post creation even if Publishing integration fails
      // This allows the post to be saved locally even if Publishing integration API fails
    }
  }

  // Determine post status:
  // 1. If scheduled_for is provided, status is 'scheduled'
  // 2. Otherwise, status is 'published' (immediate post, not draft)
  // Note: Posts created immediately should be 'published', not 'draft'
  const postStatus: 'draft' | 'scheduled' | 'published' = scheduledForIso ? 'scheduled' : 'published';

  // Create post in local database
  const { data: inserted, error } = await supabase.from('posts').insert([
    {
      user_id: user.id,
      brand_id: payload.brand_id || null,
      content: payload.content,
      image_url: payload.image_url ?? null,
      ai_caption: payload.ai_caption ?? null,
      hashtags: payload.hashtags ?? [],
      media_type: payload.media_type ?? 'text',
      metadata: payload.metadata ?? null,
      getlate_post_id: getlatePostId,
      timezone: payload.timezone,
      platforms: getlatePlatforms,
      status: postStatus,
    },
  ]).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Increment post creation counter
  // Use the increment_user_usage function from migration 0009
  try {
    const { error: rpcError } = await supabase.rpc('increment_user_usage', {
      p_user_id: user.id,
      p_counter_type: 'post',
      p_amount: 1,
    });
    if (rpcError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Post Creation] Failed to increment usage counter:', rpcError);
      }
    }
  } catch (error) {
    // Log error but don't fail the request
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Post Creation] Error calling increment_user_usage:', error);
    }
  }

  // If post was created with Publishing integration, sync analytics in the background
  if (getlatePostId && payload.brand_id) {
    // Sync analytics asynchronously (don't wait for it)
    // Pass Publishing integration post ID directly for faster lookup
    // Note: For immediate publishing, analytics may not be available immediately
    // The sync will handle this gracefully and can be retried later
    syncAnalyticsFromGetlate(supabase, user.id, payload.brand_id, {
      getlatePostId,
    }).catch((error) => {
      // Log error but don't break post creation
      // Analytics sync failures are non-critical - user can manually sync later
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Post Creation] Analytics sync failed (non-critical):', error?.message || error);
      }
    });
  }

  return NextResponse.json({ data: inserted }, { status: 201 });
}
