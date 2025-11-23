import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncAnalyticsFromGetlate } from '@/libs/analytics-sync';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const postId = url.searchParams.get('postId');
  const brandId = url.searchParams.get('brandId');
  const platform = url.searchParams.get('platform');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const use_getlate = url.searchParams.get('use_getlate') === 'true';

  const QuerySchema = z.object({
    postId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    platform: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    use_getlate: z.boolean().optional(),
  });
  const parsed = QuerySchema.parse({ postId, brandId, platform, start, end, use_getlate });

  // Auto-detect if brand has Getlate profile and sync analytics
  // If brandId is provided, check if it has Getlate profile and sync automatically
  let shouldSyncFromGetlate = parsed.use_getlate;
  if (!shouldSyncFromGetlate && parsed.brandId) {
    const { data: brandCheck } = await supabase
      .from('brands')
      .select('getlate_profile_id')
      .eq('id', parsed.brandId)
      .eq('user_id', user.id)
      .single();

    shouldSyncFromGetlate = !!brandCheck?.getlate_profile_id;
  }

  // Sync analytics from Getlate if needed
  if (shouldSyncFromGetlate && parsed.brandId) {
    await syncAnalyticsFromGetlate(supabase, user.id, parsed.brandId, {
      postId: parsed.postId,
      platform: parsed.platform,
      fromDate: parsed.start,
      toDate: parsed.end,
    });
  }

  // Fetch analytics from local database
  // IMPORTANT: Always filter by user_id to ensure users only see their own analytics
  if (parsed.postId) {
    // First verify the post belongs to the user
    const { data: postCheck } = await supabase
      .from('posts')
      .select('id')
      .eq('id', parsed.postId)
      .eq('user_id', user.id)
      .single();

    if (!postCheck) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('post_analytics')
      .select('*')
      .eq('post_id', parsed.postId)
      .order('date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  let query = supabase
    .from('post_analytics')
    .select('post_id,likes,comments,shares,impressions,engagement_rate,platform,date');

  // Always filter by user_id through posts to ensure security
  // Get all posts for the user (and optionally filtered by brand)
  let postsQuery = supabase
    .from('posts')
    .select('id')
    .eq('user_id', user.id); // CRITICAL: Always filter by user_id

  if (parsed.brandId) {
    // Also verify the brand belongs to the user
    const { data: brandCheck } = await supabase
      .from('brands')
      .select('id')
      .eq('id', parsed.brandId)
      .eq('user_id', user.id)
      .single();

    if (!brandCheck) {
      return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 404 });
    }

    postsQuery = postsQuery.eq('brand_id', parsed.brandId);
  }

  const { data: userPosts } = await postsQuery;

  if (!userPosts || userPosts.length === 0) {
    // No posts for this user/brand, return empty
    return NextResponse.json({ data: [] });
  }

  const postIds = userPosts.map(p => p.id);
  query = query.in('post_id', postIds);

  if (parsed.platform) {
    query = query.eq('platform', parsed.platform);
  }

  if (parsed.start) {
    query = query.gte('date', parsed.start);
  }

  if (parsed.end) {
    query = query.lte('date', parsed.end);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
