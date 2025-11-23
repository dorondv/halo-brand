import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * POST /api/getlate/disconnect
 * Disconnect an account from Getlate profile
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, getlateAccountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 422 },
      );
    }

    // Get the account from database to verify ownership and get Getlate account ID
    const { data: accountRecord, error: accountError } = await supabase
      .from('social_accounts')
      .select('id, getlate_account_id, brand_id, user_id, platform')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountRecord) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 404 },
      );
    }

    // Use provided getlateAccountId or the one from database
    const getlateAccountIdToDisconnect = getlateAccountId || accountRecord.getlate_account_id;

    if (!getlateAccountIdToDisconnect) {
      // Account not linked to Getlate, just update database
      return NextResponse.json({
        success: true,
        message: 'Account disconnected from local database (not linked to Getlate)',
      });
    }

    // Get user record to fetch Getlate API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!userRecord.getlate_api_key) {
      return NextResponse.json(
        { error: 'Getlate API key not configured' },
        { status: 400 },
      );
    }

    // Disconnect account from Getlate
    try {
      const getlateClient = createGetlateClient(userRecord.getlate_api_key);
      await getlateClient.disconnectAccount(getlateAccountIdToDisconnect);
    } catch (getlateError) {
      const errorMessage = getlateError instanceof Error ? getlateError.message : String(getlateError);
      console.error(`[Getlate Disconnect] ❌ Error disconnecting account from Getlate:`, {
        error: errorMessage,
        getlateAccountId: getlateAccountIdToDisconnect,
        stack: getlateError instanceof Error ? getlateError.stack : undefined,
      });

      // If Getlate disconnect fails, we still want to disconnect locally
      // But return the error so frontend knows it failed
      return NextResponse.json(
        {
          success: false,
          warning: 'Account disconnected locally, but Getlate disconnect failed',
          error: errorMessage,
        },
        { status: 500 }, // Return 500 to indicate Getlate disconnect failed
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account disconnected from Getlate successfully',
    });
  } catch (error) {
    console.error('Error disconnecting account from Getlate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect account' },
      { status: 500 },
    );
  }
}
