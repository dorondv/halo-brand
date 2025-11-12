import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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

    // Parse URL manually to handle malformed query strings
    // Getlate may append ?connected=... instead of &connected=... to our redirect URL
    // The brandId parameter may be URL-encoded and contain the connected parameter
    const url = new URL(request.url);
    const urlString = decodeURIComponent(request.url);

    // Extract brandId first - it might be malformed if Getlate appended params with ? instead of &
    let brandId: string | null = null;
    const brandIdMatch = urlString.match(/[?&]brandId=([^&?]+)/);
    if (brandIdMatch && brandIdMatch[1]) {
      let rawBrandId = brandIdMatch[1];
      // Decode URL encoding
      try {
        rawBrandId = decodeURIComponent(rawBrandId);
      } catch {
        // If decoding fails, use as-is
      }

      // If brandId contains a ? or encoded ?, Getlate appended params incorrectly
      // Extract just the UUID (everything before the ? or %3F)
      if (rawBrandId.includes('?')) {
        const parts = rawBrandId.split('?');
        brandId = parts[0] || null;
      } else if (rawBrandId.includes('%3F')) {
        const parts = rawBrandId.split('%3F');
        brandId = parts[0] || null;
      } else {
        brandId = rawBrandId;
      }
    }

    // Getlate API returns success params: connected, profileId, username
    // Or error params: error, platform
    // Note: brandId is our custom parameter, not from Getlate
    let connected = url.searchParams.get('connected');
    const profileId = url.searchParams.get('profileId');
    const username = url.searchParams.get('username');
    const error = url.searchParams.get('error');
    const platform = url.searchParams.get('platform');

    // If connected is null, try to extract from the URL string (Getlate may have appended it incorrectly)
    if (!connected) {
      // Try to find connected parameter in the URL string (could be ?connected= or &connected=)
      const connectedMatch = urlString.match(/[?&]connected=([^&]+)/);
      if (connectedMatch && connectedMatch[1]) {
        try {
          connected = decodeURIComponent(connectedMatch[1]);
        } catch {
          connected = connectedMatch[1];
        }
      }
    }

    // Handle OAuth errors and cancellations
    if (error) {
      console.error('OAuth error from Getlate:', error, 'platform:', platform);
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = '/connections';

      // Check if it's a cancellation (common OAuth cancellation error codes)
      const isCancelled = error === 'access_denied'
        || error === 'user_cancelled'
        || error === 'user_cancelled_authorize'
        || error === 'cancelled'
        || error === 'connection_failed'
        || error.toLowerCase().includes('cancel')
        || error.toLowerCase().includes('denied');

      if (isCancelled) {
        redirectUrl.search = '?cancelled=true';
      } else {
        redirectUrl.search = `?error=${encodeURIComponent(error)}${platform ? `&platform=${platform}` : ''}`;
      }
      return NextResponse.redirect(redirectUrl);
    }

    // Handle success case - Getlate returns: connected, profileId, username
    // Note: 'connected' might be the platform name (e.g., 'facebook') instead of 'true'
    if (!connected || !profileId) {
      console.error('Missing required parameters:', { connected, profileId, username, error, platform, brandId });
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = '/connections';
      redirectUrl.search = `?error=missing_parameters&connected=${connected || 'none'}&profileId=${profileId || 'none'}`;
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
    // Sync accounts for the specific brand that was connected (if brandId provided)
    // Otherwise sync all brands with matching profileId
    let brandsToSync: Array<{ id: string; getlate_profile_id: string }> = [];

    if (brandId) {
      // Sync only the specific brand
      const { data: brand } = await supabase
        .from('brands')
        .select('id, getlate_profile_id')
        .eq('id', brandId)
        .eq('user_id', user.id)
        .single();

      if (brand && brand.getlate_profile_id === profileId) {
        brandsToSync = [brand];
      }
    } else {
      // Sync all brands with matching profileId
      const { data: brands } = await supabase
        .from('brands')
        .select('id, getlate_profile_id')
        .eq('user_id', user.id)
        .eq('getlate_profile_id', profileId);

      brandsToSync = brands || [];
    }

    // Sync accounts for the brand(s)
    // Pass oauthReconnect=true to indicate this is an OAuth-initiated sync
    // This allows the sync to clear manually_disconnected flags for reconnected accounts
    let syncSuccess = false;
    for (const brand of brandsToSync) {
      if (brand.getlate_profile_id) {
        try {
          // Use the accounts sync API endpoint which handles all the logic
          // Pass oauthReconnect=true to allow reconnection of manually disconnected accounts
          const syncResponse = await fetch(`${request.nextUrl.origin}/api/getlate/accounts?brandId=${brand.id}&oauthReconnect=true`, {
            method: 'GET',
            headers: {
              Cookie: request.headers.get('cookie') || '',
            },
          });

          if (syncResponse.ok) {
            syncSuccess = true;
          } else {
            console.error(`Failed to sync accounts for brand ${brand.id}:`, await syncResponse.text().catch(() => 'Unknown error'));
          }
        } catch (error) {
          console.error(`Error syncing accounts for brand ${brand.id}:`, error);
          // Continue with redirect even if sync fails
        }
      }
    }

    // If no brands were found to sync, that's also an error
    if (brandsToSync.length === 0) {
      console.error('No brands found to sync for profileId:', profileId, 'brandId:', brandId);
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = '/connections';
      redirectUrl.search = `?error=brand_not_found${brandId ? `&brandId=${brandId}` : ''}`;
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect to connections page with success message
    // Include brandId and sync status in redirect
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/connections';
    redirectUrl.search = `?connected=${connected}${username ? `&username=${encodeURIComponent(username)}` : ''}${brandId ? `&brandId=${brandId}` : ''}&synced=${syncSuccess ? 'true' : 'false'}`;
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/connections';
    redirectUrl.search = `?error=${encodeURIComponent('callback_failed')}`;
    return NextResponse.redirect(redirectUrl);
  }
}
