import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * GET /api/getlate/googlebusiness/locations
 * Proxies Zernio GET /v1/connect/googlebusiness/locations (headless GBP list).
 * @see https://docs.getlate.dev/connect/list-google-business-locations
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId') || undefined;
    const tempToken = searchParams.get('tempToken') || undefined;
    const pendingDataToken = searchParams.get('pendingDataToken') || searchParams.get('pending_data_token') || undefined;
    const connectToken = request.headers.get('X-Connect-Token') || request.headers.get('x-connect-token') || undefined;

    if (!pendingDataToken && !tempToken) {
      return NextResponse.json(
        { error: 'Missing required query: pendingDataToken or tempToken' },
        { status: 400 },
      );
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord || !userRecord.getlate_api_key) {
      return NextResponse.json({ error: 'User not found or integration not configured' }, { status: 404 });
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    const locations = await getlateClient.getGoogleBusinessLocations({
      profileId,
      tempToken,
      pendingDataToken,
      connectToken,
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Error fetching Google Business locations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch locations' },
      { status: 500 },
    );
  }
}
