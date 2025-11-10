import type { GetlatePlatform } from '@/libs/Getlate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncAnalyticsFromGetlate } from '@/libs/analytics-sync';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

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
    metadata: z.any().optional(),
    brand_id: z.string().uuid().optional(),
    scheduled_for: z.string().optional(), // ISO timestamp
    timezone: z.string().optional(), // IANA timezone
    platforms: z.array(z.object({
      platform: z.string(),
      account_id: z.string().uuid(),
      config: z.any().optional(),
    })).optional(),
    use_getlate: z.boolean().optional().default(false), // Whether to use Getlate API
  });

  const parse = PostSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.message }, { status: 422 });
  }

  const payload = parse.data;

  // If using Getlate, create post via Getlate API
  let getlatePostId: string | null = null;
  let getlatePlatforms: any[] | null = null;

  if (payload.use_getlate && payload.brand_id) {
    try {
      // Get user's Getlate API key
      const { data: userRecord } = await supabase
        .from('users')
        .select('getlate_api_key')
        .eq('id', user.id)
        .single();

      if (userRecord?.getlate_api_key) {
        // Get brand's Getlate profile ID
        const { data: brandRecord } = await supabase
          .from('brands')
          .select('getlate_profile_id')
          .eq('id', payload.brand_id)
          .eq('user_id', user.id)
          .single();

        if (brandRecord?.getlate_profile_id) {
          const getlateClient = createGetlateClient(userRecord.getlate_api_key);

          // Map platforms to Getlate format
          // The account_id in payload.platforms might be either:
          // 1. Local database ID (if not using Getlate)
          // 2. Getlate account ID (if already mapped by frontend)
          // We need to fetch social accounts to get getlate_account_id for local IDs
          const accountIds = (payload.platforms || []).map(p => p.account_id);
          const { data: socialAccounts } = await supabase
            .from('social_accounts')
            .select('id, getlate_account_id, platform')
            .in('id', accountIds)
            .eq('brand_id', payload.brand_id);

          // Also check if any account_ids are already getlate_account_ids
          const { data: accountsByGetlateId } = await supabase
            .from('social_accounts')
            .select('id, getlate_account_id, platform')
            .in('getlate_account_id', accountIds)
            .eq('brand_id', payload.brand_id);

          // Create maps: local ID -> getlate_account_id and getlate_account_id -> getlate_account_id
          const localIdToGetlateMap = new Map(
            socialAccounts?.map(acc => [acc.id, acc.getlate_account_id]) || [],
          );
          const getlateIdMap = new Map(
            accountsByGetlateId?.map(acc => [acc.getlate_account_id, acc.getlate_account_id]) || [],
          );

          // Map platforms to Getlate format with proper account IDs
          const getlatePlatformsArray = (payload.platforms || []).map((p) => {
            // Check if account_id is already a getlate_account_id or needs to be looked up
            const getlateAccountId = getlateIdMap.get(p.account_id)
              || localIdToGetlateMap.get(p.account_id);

            // If we couldn't find a getlate_account_id, this account might not be connected via Getlate
            if (!getlateAccountId) {
              return null;
            }

            return {
              platform: (p.platform === 'x' ? 'twitter' : p.platform) as GetlatePlatform,
              accountId: getlateAccountId, // Getlate API expects accountId (camelCase)
              platformSpecificData: p.config || {},
            };
          }).filter(Boolean) as Array<{
            platform: GetlatePlatform;
            accountId: string;
            platformSpecificData?: Record<string, unknown>;
          }>;

          // If no valid Getlate accounts found, skip Getlate integration
          if (getlatePlatformsArray.length === 0) {
            // Continue with local post creation
          } else {
            // Create post in Getlate
            const getlatePost = await getlateClient.createPost({
              profileId: brandRecord.getlate_profile_id,
              content: payload.content,
              mediaUrls: payload.image_url ? [payload.image_url] : undefined,
              scheduledFor: payload.scheduled_for,
              timezone: payload.timezone,
              platforms: getlatePlatformsArray,
            });

            getlatePostId = getlatePost.id || (getlatePost as any)._id;
            getlatePlatforms = getlatePost.platforms;
          }
        }
      }
    } catch {
      // Continue with local post creation even if Getlate fails
    }
  }

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
      status: payload.scheduled_for ? 'scheduled' : 'draft',
    },
  ]).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If post was created with Getlate, sync analytics in the background
  if (getlatePostId && payload.brand_id) {
    // Sync analytics asynchronously (don't wait for it)
    // Pass Getlate post ID directly for faster lookup
    syncAnalyticsFromGetlate(supabase, user.id, payload.brand_id, {
      getlatePostId,
    }).catch(() => {
      // Silently fail - analytics sync should not break post creation
    });
  }

  return NextResponse.json({ data: inserted }, { status: 201 });
}
