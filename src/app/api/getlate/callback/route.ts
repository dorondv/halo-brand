import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * GET /api/getlate/callback
 * Handle OAuth callback from Getlate after user authorizes social account
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = '/sign-in';
      redirectUrl.search = '?error=unauthorized';
      return NextResponse.redirect(redirectUrl);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors and cancellations
    if (error) {
      console.error('OAuth error:', error);
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = '/connections';

      // Check if it's a cancellation (common OAuth cancellation error codes)
      const isCancelled = error === 'access_denied'
        || error === 'user_cancelled'
        || error === 'user_cancelled_authorize'
        || error === 'cancelled'
        || error.toLowerCase().includes('cancel')
        || error.toLowerCase().includes('denied');

      if (isCancelled) {
        redirectUrl.search = '?cancelled=true';
      } else {
        redirectUrl.search = `?error=${encodeURIComponent(error)}`;
      }
      return NextResponse.redirect(redirectUrl);
    }

    if (!code || !state) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = '/connections';
      redirectUrl.search = '?error=missing_parameters';
      return NextResponse.redirect(redirectUrl);
    }

    // Get user record to fetch API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord || !userRecord.getlate_api_key) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = '/connections';
      redirectUrl.search = '?error=integration_not_configured';
      return NextResponse.redirect(redirectUrl);
    }

    // The OAuth flow is handled by Getlate, so we just need to sync accounts
    // Get all brands for this user to sync their accounts
    const { data: brands } = await supabase
      .from('brands')
      .select('id, getlate_profile_id')
      .eq('user_id', user.id)
      .not('getlate_profile_id', 'is', null);

    if (brands && brands.length > 0) {
      const getlateClient = createGetlateClient(userRecord.getlate_api_key);

      // Sync accounts for all brands
      for (const brand of brands) {
        if (brand.getlate_profile_id) {
          try {
            const getlateAccounts = await getlateClient.getAccounts(brand.getlate_profile_id);

            // Sync accounts to database
            for (const getlateAccount of getlateAccounts) {
              // Check if account already exists
              const { data: existingAccount } = await supabase
                .from('social_accounts')
                .select('id')
                .eq('getlate_account_id', getlateAccount.id)
                .maybeSingle();

              if (existingAccount) {
                // Update existing account
                await supabase
                  .from('social_accounts')
                  .update({
                    account_name: getlateAccount.accountName,
                    account_id: getlateAccount.accountId,
                    platform_specific_data: {
                      display_name: getlateAccount.displayName,
                      avatar_url: getlateAccount.avatarUrl,
                      follower_count: getlateAccount.followerCount,
                      last_sync: getlateAccount.lastSync,
                      ...getlateAccount.metadata,
                    },
                    is_active: getlateAccount.isConnected,
                  })
                  .eq('id', existingAccount.id);
              } else {
                // Create new account
                await supabase
                  .from('social_accounts')
                  .insert({
                    user_id: user.id,
                    brand_id: brand.id,
                    platform: getlateAccount.platform,
                    account_name: getlateAccount.accountName,
                    account_id: getlateAccount.accountId,
                    getlate_account_id: getlateAccount.id,
                    access_token: 'getlate-managed',
                    platform_specific_data: {
                      display_name: getlateAccount.displayName,
                      avatar_url: getlateAccount.avatarUrl,
                      follower_count: getlateAccount.followerCount,
                      last_sync: getlateAccount.lastSync,
                      ...getlateAccount.metadata,
                    },
                    is_active: getlateAccount.isConnected,
                  });
              }
            }
          } catch (error) {
            console.error(`Error syncing accounts for brand ${brand.id}:`, error);
            // Continue with other brands even if one fails
          }
        }
      }
    }

    // Redirect to create-post page with success message (user requested this)
    // The accounts will be synced and displayed automatically
    // Use the origin from the request to build the redirect URL
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/create-post';
    redirectUrl.search = '?connected=true';
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/connections';
    redirectUrl.search = `?error=${encodeURIComponent('callback_failed')}`;
    return NextResponse.redirect(redirectUrl);
  }
}
