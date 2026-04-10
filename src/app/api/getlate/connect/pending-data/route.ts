import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * GET /api/getlate/connect/pending-data
 * Proxies Zernio GET /v1/connect/pending-data — resolves headless OAuth state (LinkedIn org list, tokens, profile).
 * @see https://docs.getlate.dev/connect/get-pending-oauth-data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token parameter' }, { status: 422 });
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord?.getlate_api_key) {
      return NextResponse.json({ error: 'User not found or integration not configured' }, { status: 404 });
    }

    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    const data = await getlateClient.getPendingOAuthData(token);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching pending OAuth data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pending OAuth data' },
      { status: 500 },
    );
  }
}
