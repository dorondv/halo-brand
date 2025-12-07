import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * Get available post types/formats from Getlate API
 * Returns formats available for each platform based on connected accounts
 *
 * Based on Getlate API documentation: https://docs.getlate.dev
 * Supported platforms and content types are defined according to the official API docs
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    // Get user's Getlate API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .maybeSingle();

    if (!userRecord?.getlate_api_key) {
      return NextResponse.json({ error: 'Getlate API key not configured' }, { status: 400 });
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);

    // Get brand's Getlate profile ID
    let profileId: string | undefined;
    if (brandId) {
      const { data: brandRecord } = await supabase
        .from('brands')
        .select('getlate_profile_id')
        .eq('id', brandId)
        .eq('user_id', user.id)
        .maybeSingle();

      profileId = brandRecord?.getlate_profile_id || undefined;
    }

    // Fetch accounts from Getlate
    const accounts = await getlateClient.getAccounts(profileId);

    // Map platform to available formats based on Getlate API capabilities
    // Based on https://docs.getlate.dev - Supported Platforms documentation
    // Getlate uses contentType in platformSpecificData
    const platformFormats: Record<string, string[]> = {
      'instagram': ['feed', 'story', 'reel', 'carousel'], // Feed posts, Stories, Reels, Carousels (up to 10 items)
      'x': ['post', 'thread'], // Text, images, videos, threads (multi-post)
      'twitter': ['post', 'thread'], // Alias for x
      'facebook': ['feed', 'story', 'video'], // Page posts, Stories (24-hour ephemeral), videos, multi-image posts (up to 10) - NO REELS
      'linkedin': ['post'], // Posts with up to 20 images, single video, single PDF document, GIFs, link previews
      'youtube': ['video', 'short'], // Videos only (≤3 min = Shorts, >3 min = regular)
      'tiktok': ['video', 'carousel'], // Videos, photo carousels (up to 35 images, no mixing photos/videos)
      'threads': ['feed', 'story'], // Text posts, images, videos (5 min max), thread sequences
      'pinterest': ['pin'], // Single image or single video per Pin
      'reddit': ['post', 'link'], // Text posts, link posts
      'bluesky': ['post'], // Text posts, up to 4 images (auto-compressed), videos, link previews
      'google-business': ['post'], // Text posts with single image, call-to-action buttons
    };

    // Group accounts by platform and determine available formats
    const result: Record<string, {
      platform: string;
      formats: string[];
      accountCount: number;
    }> = {};

    accounts.forEach((account) => {
      const normalizedPlatform = account.platform === 'twitter' ? 'x' : account.platform;
      const sourcePlatform = account.platform === 'twitter' ? 'twitter' : account.platform;

      if (!result[normalizedPlatform]) {
        result[normalizedPlatform] = {
          platform: normalizedPlatform,
          formats: platformFormats[sourcePlatform] || platformFormats[normalizedPlatform] || ['post'],
          accountCount: 0,
        };
      }

      result[normalizedPlatform].accountCount++;
    });

    // Also include platforms that might not have accounts yet but are supported
    Object.keys(platformFormats).forEach((platform) => {
      const normalizedPlatform = platform === 'twitter' ? 'x' : platform;
      if (!result[normalizedPlatform]) {
        result[normalizedPlatform] = {
          platform: normalizedPlatform,
          formats: platformFormats[platform] || ['post'],
          accountCount: 0,
        };
      }
    });

    return NextResponse.json({
      platforms: Object.values(result),
      formats: platformFormats,
    });
  } catch (error) {
    console.error('[Getlate Post Types] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch post types' },
      { status: 500 },
    );
  }
}
