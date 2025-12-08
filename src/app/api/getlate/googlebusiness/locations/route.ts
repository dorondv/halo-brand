import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * GET /api/getlate/googlebusiness/locations
 * Fetch available Google Business locations during headless OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const tempToken = searchParams.get('tempToken');
    const connectToken = request.headers.get('X-Connect-Token') || request.headers.get('x-connect-token');

    if (!profileId || !tempToken || !connectToken) {
      return NextResponse.json(
        { error: 'Missing required parameters: profileId, tempToken, and X-Connect-Token header' },
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

    // Create Getlate client and fetch locations
    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    const locations = await getlateClient.getGoogleBusinessLocations(profileId, tempToken, connectToken);

    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Error fetching Google Business locations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch locations' },
      { status: 500 },
    );
  }
}
