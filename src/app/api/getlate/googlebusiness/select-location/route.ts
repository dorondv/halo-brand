import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * POST /api/getlate/googlebusiness/select-location
 * Save selected Google Business location during headless OAuth flow
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
      profileId: z.string(),
      locationId: z.string(),
      tempToken: z.string(),
      userProfile: z.any(),
      redirectUrl: z.string().url().optional(),
    });

    const parse = Schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.message }, { status: 422 });
    }

    const { profileId, locationId, tempToken, userProfile, redirectUrl } = parse.data;
    const connectToken = request.headers.get('X-Connect-Token') || request.headers.get('x-connect-token');

    if (!connectToken) {
      return NextResponse.json(
        { error: 'Missing X-Connect-Token header' },
        { status: 400 },
      );
    }

    // Get user record to fetch API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord || !userRecord.getlate_api_key) {
      return NextResponse.json({ error: 'User not found or integration not configured' }, { status: 404 });
    }

    // Create Getlate client and save location selection
    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    await getlateClient.selectGoogleBusinessLocation(
      {
        profileId,
        locationId,
        tempToken,
        userProfile,
        redirectUrl,
      },
      connectToken,
    );

    // After successful location selection, sync accounts
    // Find brand by profileId
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('getlate_profile_id', profileId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (brand) {
      // Sync accounts in background
      fetch(`${request.nextUrl.origin}/api/getlate/accounts?brandId=${brand.id}&oauthReconnect=true`, {
        method: 'GET',
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      }).catch(() => {
        // Ignore sync errors - connection is still successful
      });
    }

    return NextResponse.json({ success: true, message: 'Google Business location selected successfully' });
  } catch (error) {
    console.error('Error selecting Google Business location:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to select location' },
      { status: 500 },
    );
  }
}
