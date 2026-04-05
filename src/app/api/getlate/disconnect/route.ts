import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * POST /api/publishing/disconnect
 * Disconnect an account from Publishing integration profile
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

    // Get the account from database to verify ownership and get Publishing integration account ID
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

    // Use provider account id from the request body or from the database row
    const getlateAccountIdToDisconnect = getlateAccountId || accountRecord.getlate_account_id;

    if (!getlateAccountIdToDisconnect) {
      // Account not linked to Publishing integration, just update database
      return NextResponse.json({
        success: true,
        message: 'Account disconnected from local database (not linked to Getlate)',
      });
    }

    // Get user record to fetch Publishing integration API key
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

    // Disconnect account from Publishing integration
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

      // If Publishing integration disconnect fails, we still allow local disconnect flow to continue.
      // Return 200 with warning so UI can proceed without blocking.
      return NextResponse.json(
        {
          success: true,
          disconnectedFromGetlate: false,
          warning: 'Account disconnected locally, but Getlate disconnect failed',
          error: errorMessage,
        },
        { status: 200 },
      );
    }

    // Deactivate duplicate rows that represent the same Publishing integration account for this user+brand.
    // This keeps the DB state canonical and prevents stale "connected" twins.
    if (getlateAccountIdToDisconnect) {
      const { data: duplicateRows } = await supabase
        .from('social_accounts')
        .select('id, platform_specific_data')
        .eq('user_id', user.id)
        .eq('brand_id', accountRecord.brand_id)
        .eq('getlate_account_id', getlateAccountIdToDisconnect)
        .neq('id', accountRecord.id);

      for (const duplicate of duplicateRows || []) {
        const duplicateMeta = (duplicate.platform_specific_data as Record<string, unknown> | null) || {};
        const { error: duplicateDeactivateError } = await supabase
          .from('social_accounts')
          .update({
            is_active: false,
            platform_specific_data: {
              ...duplicateMeta,
              manually_disconnected_at: new Date().toISOString(),
              manually_disconnected: true,
              duplicate_of_account_id: accountRecord.id,
            },
          })
          .eq('id', duplicate.id)
          .eq('user_id', user.id);

        if (duplicateDeactivateError) {
          console.error(`[Getlate Disconnect] Failed deactivating duplicate account ${duplicate.id}:`, duplicateDeactivateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      disconnectedFromGetlate: true,
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
