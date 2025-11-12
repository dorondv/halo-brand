import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * GET /api/getlate/accounts
 * Get all connected accounts from Getlate and sync with database
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 422 });
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
        { error: 'Brand not linked to Getlate profile' },
        { status: 400 },
      );
    }

    // Fetch accounts from Getlate
    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    const getlateAccountsResponse = await getlateClient.getAccounts(brandRecord.getlate_profile_id);

    // getAccounts already handles response format and returns array
    const getlateAccounts = getlateAccountsResponse;

    if (!Array.isArray(getlateAccounts)) {
      return NextResponse.json(
        { error: 'Invalid response format from Getlate API: expected array' },
        { status: 500 },
      );
    }

    // Sync accounts with database
    const syncedAccounts = [];
    for (const getlateAccount of getlateAccounts) {
      // Handle Getlate API response format:
      // _id, username, profilePicture, isActive, displayName, tokenExpiresAt, permissions
      // getAccounts() already maps these fields, so we can use the mapped values
      const accountId = getlateAccount._id || getlateAccount.id;
      if (!accountId) {
        continue;
      }

      const platform = getlateAccount.platform;
      if (!platform) {
        continue;
      }

      // Use mapped values from getAccounts()
      // Getlate API uses 'username', getAccounts() maps it to 'accountName'
      const accountName = getlateAccount.accountName || getlateAccount.username || '';
      if (!accountName) {
        continue;
      }

      const accountIdValue = getlateAccount.accountId || accountId;
      const displayName = getlateAccount.displayName || accountName; // Fallback to accountName if displayName not provided
      const avatarUrl = getlateAccount.avatarUrl || getlateAccount.profilePicture;
      const followerCount = getlateAccount.followerCount || 0;
      const lastSync = getlateAccount.lastSync || new Date().toISOString();
      // Getlate API uses 'isActive', getAccounts() maps it to 'isConnected'
      const isConnected = getlateAccount.isConnected !== undefined
        ? getlateAccount.isConnected
        : (getlateAccount.isActive !== undefined ? getlateAccount.isActive : true);
      const tokenExpiresAt = getlateAccount.tokenExpiresAt;
      const permissions = getlateAccount.permissions || [];
      const metadata = {
        ...(getlateAccount.metadata || {}),
        tokenExpiresAt,
        permissions,
      };

      // Normalize platform name (twitter -> twitter, x -> twitter for storage)
      const normalizedPlatform = platform === 'x' || platform === 'twitter' ? 'twitter' : platform.toLowerCase();

      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from('social_accounts')
        .select('id, platform_specific_data')
        .eq('getlate_account_id', accountId)
        .eq('brand_id', brandId)
        .maybeSingle();

      if (existingAccount) {
        // Check if account was manually disconnected
        const platformData = existingAccount.platform_specific_data as Record<string, unknown> | null;
        const manuallyDisconnected = platformData?.manually_disconnected === true;

        // If manually disconnected, don't reactivate it even if Getlate says it's connected
        const shouldBeActive = manuallyDisconnected ? false : isConnected;

        // Update existing account
        const { data: updatedAccount } = await supabase
          .from('social_accounts')
          .update({
            account_name: accountName,
            account_id: accountIdValue,
            platform: normalizedPlatform,
            platform_specific_data: {
              display_name: displayName,
              avatar_url: avatarUrl,
              follower_count: followerCount,
              last_sync: lastSync,
              // Preserve manually_disconnected flag if it exists
              ...(manuallyDisconnected
                ? {
                    manually_disconnected: true,
                    manually_disconnected_at: platformData?.manually_disconnected_at,
                  }
                : {}),
              ...metadata,
            },
            is_active: shouldBeActive,
          })
          .eq('id', existingAccount.id)
          .select()
          .single();

        if (updatedAccount) {
          syncedAccounts.push(updatedAccount);
        }
      } else {
        // Create new account
        const { data: newAccount } = await supabase
          .from('social_accounts')
          .insert({
            user_id: user.id,
            brand_id: brandId,
            platform: normalizedPlatform,
            account_name: accountName,
            account_id: accountIdValue,
            getlate_account_id: accountId,
            access_token: 'getlate-managed', // Getlate manages tokens
            platform_specific_data: {
              display_name: displayName,
              avatar_url: avatarUrl,
              follower_count: followerCount,
              last_sync: lastSync,
              ...metadata,
            },
            is_active: isConnected,
          })
          .select()
          .single();

        if (newAccount) {
          syncedAccounts.push(newAccount);
        }
      }
    }

    return NextResponse.json({ accounts: syncedAccounts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync accounts' },
      { status: 500 },
    );
  }
}
