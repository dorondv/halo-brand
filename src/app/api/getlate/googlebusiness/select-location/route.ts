import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * POST /api/getlate/googlebusiness/select-location
 * Proxies Zernio POST /v1/connect/googlebusiness/select-location.
 * @see https://docs.getlate.dev/connect/select-google-business-location
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
      profileId: z.string().min(1),
      locationId: z.string().min(1),
      pendingDataToken: z.string().optional(),
      tempToken: z.string().optional(),
      userProfile: z.any().optional(),
      redirectUrl: z.string().url().optional(),
    }).refine(
      data => Boolean(data.pendingDataToken) || Boolean(data.tempToken),
      { message: 'Either pendingDataToken or tempToken is required' },
    );

    const parse = Schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.message }, { status: 422 });
    }

    const { profileId, locationId, pendingDataToken, tempToken, userProfile, redirectUrl } = parse.data;
    const connectToken = request.headers.get('X-Connect-Token') || request.headers.get('x-connect-token') || undefined;

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord || !userRecord.getlate_api_key) {
      return NextResponse.json({ error: 'User not found or integration not configured' }, { status: 404 });
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    await getlateClient.selectGoogleBusinessLocation(
      {
        profileId,
        locationId,
        pendingDataToken,
        tempToken,
        userProfile,
        redirectUrl,
      },
      connectToken,
    );

    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('getlate_profile_id', profileId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (brand) {
      fetch(`${request.nextUrl.origin}/api/getlate/accounts?brandId=${brand.id}&oauthReconnect=true`, {
        method: 'GET',
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      }).catch(() => {});
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
