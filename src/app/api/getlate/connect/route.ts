import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Env } from '@/libs/Env';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * POST /api/getlate/connect
 * Initiate OAuth connection flow for a social account via Getlate
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const Schema = z.object({
      platform: z.enum(['twitter', 'x', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'threads']),
      brandId: z.string().uuid(),
      redirectUrl: z.string().url().optional(),
    });

    const parse = Schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.message }, { status: 422 });
    }

    const { platform, brandId, redirectUrl } = parse.data;

    // Get user record to fetch API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Auto-setup integration if not configured
    if (!userRecord.getlate_api_key) {
      // Get service account API key from environment
      const serviceApiKey = Env.GETLATE_SERVICE_API_KEY;
      if (!serviceApiKey) {
        console.error('GETLATE_SERVICE_API_KEY not configured');
        return NextResponse.json(
          { error: 'Integration service not configured' },
          { status: 500 },
        );
      }

      // Store the service API key for the user
      const { error: updateError } = await supabase
        .from('users')
        .update({ getlate_api_key: serviceApiKey })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error saving API key:', updateError);
        return NextResponse.json(
          { error: 'Failed to initialize integration' },
          { status: 500 },
        );
      }

      userRecord.getlate_api_key = serviceApiKey;
    }

    // Get brand to fetch Getlate profile ID
    const { data: brandRecord, error: brandError } = await supabase
      .from('brands')
      .select('id, getlate_profile_id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brandRecord) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    if (!brandRecord.getlate_profile_id) {
      return NextResponse.json(
        { error: 'Brand not linked to Getlate profile. Please create a Getlate profile first.' },
        { status: 400 },
      );
    }

    // Create Getlate client and initiate OAuth flow
    const getlateClient = createGetlateClient(userRecord.getlate_api_key);

    // Normalize platform (x -> twitter for Getlate API)
    const getlatePlatform = platform === 'x' ? 'twitter' : platform;

    // Build the redirect URL - this is where Getlate will redirect after OAuth
    // Use the origin from headers if nextUrl.origin is not available
    const origin = request.nextUrl.origin
      || request.headers.get('origin')
      || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
      || 'http://localhost:3000';

    // Default redirect URL points to our callback handler
    // Getlate will append success/error parameters: ?connected=platform&profileId=...&username=...
    const defaultRedirectUrl = `${origin}/api/getlate/callback?brandId=${brandId}`;
    const finalRedirectUrl = redirectUrl || defaultRedirectUrl;

    // Validate redirect URL is a proper URL
    try {
      // eslint-disable-next-line no-new
      new URL(finalRedirectUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid redirect URL format' },
        { status: 400 },
      );
    }

    // Use the official /connect endpoint with redirect_url parameter
    // Parameter order: (platform, profileId, redirectUrl)
    const connectResult = await getlateClient.connectAccount(
      getlatePlatform as any,
      brandRecord.getlate_profile_id,
      finalRedirectUrl,
    );

    // Validate that we got an auth URL
    if (!connectResult.authUrl) {
      return NextResponse.json(
        { error: 'Failed to get OAuth URL from Getlate' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      authUrl: connectResult.authUrl,
      state: connectResult.state, // May be undefined for GET endpoint
    });
  } catch (error) {
    console.error('Error initiating Getlate connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate connection' },
      { status: 500 },
    );
  }
}
