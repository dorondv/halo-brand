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
    // Getlate may append ?error=... instead of &error=... to our redirect URL
    // This creates URLs like: /callback?brandId=xxx?error=yyy&platform=zzz
    const url = new URL(request.url);
    const urlString = request.url;
    const decodedUrlString = decodeURIComponent(urlString);

    // Extract all parameters manually to handle malformed URLs with multiple ? characters
    const extractParam = (paramName: string): string | null => {
      // Try standard searchParams first
      const standardValue = url.searchParams.get(paramName);
      if (standardValue) {
        return standardValue;
      }

      // Try to extract from URL string (handles malformed URLs with multiple ?)
      // Match both ?param=value and &param=value patterns
      const patterns = [
        new RegExp(`[?&]${paramName}=([^&?]+)`, 'i'),
        new RegExp(`[?&]${paramName}=([^&?\\s]+)`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = decodedUrlString.match(pattern);
        if (match && match[1]) {
          try {
            return decodeURIComponent(match[1]);
          } catch {
            return match[1];
          }
        }
      }

      return null;
    };

    // Extract brandId first - it might be malformed if Getlate appended params with ? instead of &
    let brandId: string | null = extractParam('brandId');
    if (brandId) {
      // If brandId contains a ? or encoded ?, Getlate appended params incorrectly
      // Extract just the UUID (everything before the ? or %3F)
      if (brandId.includes('?')) {
        const parts = brandId.split('?');
        brandId = parts[0] || null;
      } else if (brandId.includes('%3F')) {
        const parts = brandId.split('%3F');
        brandId = parts[0] || null;
      }
    }

    // Extract all parameters using our custom extractor
    // Getlate API returns success params: connected, profileId, username
    // Or error params: error, platform
    // Headless mode params: profileId, tempToken, userProfile, connect_token, platform, step
    const connected = extractParam('connected');
    const profileId = extractParam('profileId');
    const username = extractParam('username');
    const error = extractParam('error');
    const platform = extractParam('platform');
    const step = extractParam('step'); // Headless mode step: select_page, select_organization, select_location
    const tempToken = extractParam('tempToken');
    const userProfile = extractParam('userProfile');
    const connectToken = extractParam('connect_token');
    const organizations = extractParam('organizations'); // LinkedIn organizations (URL-encoded JSON)

    // Handle OAuth errors and cancellations
    // Check for error parameter first (Getlate returns error on failure)
    if (error) {
      console.error('OAuth error from Getlate:', error, 'platform:', platform, 'brandId:', brandId);

      // Build redirect URL with proper origin
      const origin = request.nextUrl.origin
        || request.headers.get('origin')
        || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || 'http://localhost:3000';

      const redirectUrl = new URL('/connections', origin);

      // Check if it's a cancellation (common OAuth cancellation error codes)
      const isCancelled = error === 'access_denied'
        || error === 'user_cancelled'
        || error === 'user_cancelled_authorize'
        || error === 'cancelled'
        || error.toLowerCase().includes('cancel')
        || error.toLowerCase().includes('denied');

      if (isCancelled) {
        redirectUrl.searchParams.set('cancelled', 'true');
      } else {
        redirectUrl.searchParams.set('error', error);
        if (platform) {
          redirectUrl.searchParams.set('platform', platform);
        }
      }

      // Include brandId if available
      if (brandId) {
        redirectUrl.searchParams.set('brandId', brandId);
      }

      return NextResponse.redirect(redirectUrl);
    }

    // Handle headless mode callback (has step parameter)
    // Headless mode redirects directly to our app with OAuth data
    // We need to redirect to connections page with headless mode parameters
    if (step) {
      const origin = request.nextUrl.origin
        || request.headers.get('origin')
        || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || 'http://localhost:3000';

      const redirectUrl = new URL('/connections', origin);

      // Pass all headless mode parameters to the connections page
      redirectUrl.searchParams.set('headless', 'true');
      redirectUrl.searchParams.set('step', step);
      if (profileId) {
        redirectUrl.searchParams.set('profileId', profileId);
      }
      if (tempToken) {
        redirectUrl.searchParams.set('tempToken', tempToken);
      }
      if (userProfile) {
        redirectUrl.searchParams.set('userProfile', userProfile);
      }
      if (connectToken) {
        redirectUrl.searchParams.set('connect_token', connectToken);
      }
      if (platform) {
        redirectUrl.searchParams.set('platform', platform);
      }
      if (organizations) {
        redirectUrl.searchParams.set('organizations', organizations);
      }
      if (brandId) {
        redirectUrl.searchParams.set('brandId', brandId);
      }

      return NextResponse.redirect(redirectUrl);
    }

    // Handle standard mode success case - Getlate returns: connected, profileId, username
    // Note: 'connected' might be the platform name (e.g., 'facebook') instead of 'true'
    if (!connected || !profileId) {
      console.error('Missing required parameters:', { connected, profileId, username, error, platform, brandId });

      // Build redirect URL with proper origin
      const origin = request.nextUrl.origin
        || request.headers.get('origin')
        || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || 'http://localhost:3000';

      const redirectUrl = new URL('/connections', origin);
      redirectUrl.searchParams.set('error', 'missing_parameters');
      redirectUrl.searchParams.set('connected', connected || 'none');
      redirectUrl.searchParams.set('profileId', profileId || 'none');
      if (brandId) {
        redirectUrl.searchParams.set('brandId', brandId);
      }
      if (platform) {
        redirectUrl.searchParams.set('platform', platform);
      }
      return NextResponse.redirect(redirectUrl);
    }

    // Get user record to fetch API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord || !userRecord.getlate_api_key) {
      const origin = request.nextUrl.origin
        || request.headers.get('origin')
        || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || 'http://localhost:3000';

      const redirectUrl = new URL('/connections', origin);
      redirectUrl.searchParams.set('error', 'integration_not_configured');
      if (brandId) {
        redirectUrl.searchParams.set('brandId', brandId);
      }
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
      const origin = request.nextUrl.origin
        || request.headers.get('origin')
        || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || 'http://localhost:3000';

      const redirectUrl = new URL('/connections', origin);
      redirectUrl.searchParams.set('error', 'brand_not_found');
      if (brandId) {
        redirectUrl.searchParams.set('brandId', brandId);
      }
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect to connections page with success message
    // Include brandId and sync status in redirect
    const origin = request.nextUrl.origin
      || request.headers.get('origin')
      || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
      || 'http://localhost:3000';

    const redirectUrl = new URL('/connections', origin);
    redirectUrl.searchParams.set('connected', connected);
    if (username) {
      redirectUrl.searchParams.set('username', username);
    }
    if (brandId) {
      redirectUrl.searchParams.set('brandId', brandId);
    }
    redirectUrl.searchParams.set('synced', syncSuccess ? 'true' : 'false');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    const origin = request.nextUrl.origin
      || request.headers.get('origin')
      || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
      || 'http://localhost:3000';

    const redirectUrl = new URL('/connections', origin);
    redirectUrl.searchParams.set('error', 'callback_failed');
    return NextResponse.redirect(redirectUrl);
  }
}
