import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const Schema = z.object({
    postId: z.string().uuid(),
    socialAccountId: z.string().uuid(),
    scheduledFor: z.string(), // ISO timestamp
    timezone: z.string().optional(), // IANA timezone
    use_getlate: z.boolean().optional().default(false), // Whether to use Getlate queue
  });
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { postId, socialAccountId, scheduledFor, timezone, use_getlate } = parsed.data;

  // Get post and account details
  const { data: postData } = await supabase
    .from('posts')
    .select('id, brand_id, getlate_post_id, content, image_url')
    .eq('id', postId)
    .single();

  const { data: accountData } = await supabase
    .from('social_accounts')
    .select('id, brand_id, getlate_account_id, platform')
    .eq('id', socialAccountId)
    .single();

  if (!postData || !accountData) {
    return NextResponse.json({ error: 'Post or account not found' }, { status: 404 });
  }

  // If using Getlate and post/account are linked to Getlate
  if (use_getlate && postData.getlate_post_id && accountData.getlate_account_id && postData.brand_id) {
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
          .eq('id', postData.brand_id)
          .single();

        if (brandRecord?.getlate_profile_id) {
          const getlateClient = createGetlateClient(userRecord.getlate_api_key);

          // Get next available queue slot if not specified
          let scheduledTime = scheduledFor;
          if (!scheduledTime) {
            const queueSlot = await getlateClient.getNextQueueSlot(
              brandRecord.getlate_profile_id,
            );
            scheduledTime = queueSlot.nextSlot;
          }

          // Update post in Getlate with scheduled time
          // Note: Getlate handles scheduling automatically when scheduled_for is set
          // The post should already be created with scheduled_for, but we can verify
        }
      }
    } catch (error) {
      console.error('Error scheduling with Getlate:', error);
      // Continue with local scheduling even if Getlate fails
    }
  }

  // Create scheduled post in local database
  const { data, error } = await supabase.from('scheduled_posts').insert([
    {
      post_id: postId,
      social_account_id: socialAccountId,
      scheduled_for: scheduledFor,
      timezone: timezone || null,
      status: 'pending',
    },
  ]).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * GET /api/schedule/next-slot
 * Get next available queue slot from Getlate
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get('brandId');
  // timezone parameter available but not currently used

  if (!brandId) {
    return NextResponse.json({ error: 'Brand ID is required' }, { status: 422 });
  }

  try {
    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (!userRecord?.getlate_api_key) {
      return NextResponse.json(
        { error: 'Getlate API key not configured' },
        { status: 400 },
      );
    }

    // Get brand's Getlate profile ID
    const { data: brandRecord } = await supabase
      .from('brands')
      .select('getlate_profile_id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (!brandRecord?.getlate_profile_id) {
      return NextResponse.json(
        { error: 'Brand not linked to Getlate profile' },
        { status: 400 },
      );
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    const queueSlot = await getlateClient.getNextQueueSlot(
      brandRecord.getlate_profile_id,
    );

    return NextResponse.json({ slot: queueSlot });
  } catch (error) {
    console.error('Error fetching next queue slot:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch next slot' },
      { status: 500 },
    );
  }
}
