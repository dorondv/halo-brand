import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 422 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Get user's Getlate API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: `Failed to fetch user record: ${userError.message}` },
        { status: 500 },
      );
    }

    if (!userRecord?.getlate_api_key) {
      return NextResponse.json(
        { error: 'Getlate API key not configured. Please connect your Getlate account first.' },
        { status: 400 },
      );
    }

    const getlateApiKey = userRecord.getlate_api_key;

    const { data: socialAccount } = await supabase
      .from('social_accounts')
      .select('id, brand_id, platform_specific_data')
      .eq('getlate_account_id', accountId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!socialAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const { data: brandRecord } = await supabase
      .from('brands')
      .select('getlate_profile_id')
      .eq('id', socialAccount.brand_id)
      .maybeSingle();

    if (!brandRecord?.getlate_profile_id) {
      return NextResponse.json(
        { error: 'Brand not linked to a Getlate profile' },
        { status: 400 },
      );
    }

    const getlateClient = createGetlateClient(getlateApiKey);

    // Try to get pages from availablePages in account data first (like getlate-test page)
    let pages: Awaited<ReturnType<typeof getlateClient.getFacebookSelectPage>> = [];

    try {
      // Fetch raw accounts to get availablePages with pages list
      const rawAccounts = await getlateClient.getRawAccounts(brandRecord.getlate_profile_id);

      // Find the Facebook account matching this getlate_account_id
      // Try multiple matching strategies since accountId format might vary
      const rawFacebookAccount = rawAccounts.find(
        (acc: any) => {
          const accId = acc._id || acc.id;
          return (accId === accountId || String(accId) === String(accountId)) && acc.platform === 'facebook';
        },
      );

      if (rawFacebookAccount) {
        // Get availablePages from multiple possible locations
        // 1. Direct property: availablePages or available_pages
        // 2. In metadata: metadata.availablePages
        // 3. In platform_specific_data: platform_specific_data.availablePages
        let availablePages = rawFacebookAccount.availablePages
          || rawFacebookAccount.available_pages
          || (rawFacebookAccount.metadata as any)?.availablePages
          || (rawFacebookAccount.metadata as any)?.available_pages
          || (rawFacebookAccount.platform_specific_data as any)?.availablePages
          || (rawFacebookAccount.platform_specific_data as any)?.available_pages;

        // Also check if metadata itself is an object with availablePages
        if (!availablePages && rawFacebookAccount.metadata && typeof rawFacebookAccount.metadata === 'object') {
          const metadata = rawFacebookAccount.metadata as any;
          availablePages = metadata.availablePages || metadata.available_pages;
        }

        if (availablePages && Array.isArray(availablePages) && availablePages.length > 0) {
          // availablePages already contains the pages list - use it directly
          // Map availablePages to GetlateFacebookPage format
          pages = availablePages.map((page: any) => ({
            id: page._id || page.id || page.pageId || page.facebookPageId,
            name: page.name || page.pageName || page.title || 'Page',
            pageId: page.pageId || page.facebookPageId || page.id,
            pageName: page.pageName || page.name || page.title,
            pictureUrl: page.picture?.data?.url || page.pictureUrl || page.logoUrl,
            accessToken: page.pageAccessToken || page.page_access_token || page.accessToken || page.access_token,
            metadata: page.metadata || {},
          })).filter(page => !!page.id && !!page.name);

          if (pages.length > 0) {
            // Return pages from availablePages
            return NextResponse.json({ pages });
          }
        }
      } else {
        console.warn(`[Getlate Facebook Pages] Facebook account with ID ${accountId} not found in raw accounts`);
      }
    } catch (fetchError) {
      console.error('[Getlate Facebook Pages] Error fetching accounts from Getlate:', fetchError);
      // Continue to fallback methods
    }

    // Fallback: Try account-specific endpoint (doesn't require tempToken)
    // This should work for already-connected accounts
    if (pages.length === 0) {
      try {
        pages = await getlateClient.getFacebookPages(accountId);
        if (pages.length > 0) {
          return NextResponse.json({ pages });
        }

        // If getFacebookPages returns empty, verify account exists and is Facebook
        // This helps debug why pages aren't available
        try {
          const rawAccounts = await getlateClient.getRawAccounts(brandRecord.getlate_profile_id);
          const accountExists = rawAccounts.some(
            (acc: any) => {
              const accId = acc._id || acc.id;
              return (accId === accountId || String(accId) === String(accountId)) && acc.platform === 'facebook';
            },
          );

          if (!accountExists) {
            console.warn(`[Getlate Facebook Pages] Account ${accountId} not found in profile ${brandRecord.getlate_profile_id}`);
          } else {
            console.warn(`[Getlate Facebook Pages] Account ${accountId} exists but has no pages available. This might be normal if the account doesn't manage any pages.`);
          }
        } catch (verifyError) {
          console.error('[Getlate Facebook Pages] Error verifying account:', verifyError);
        }

        // Return empty pages array - this is valid if account has no pages
        return NextResponse.json({ pages: [] });
      } catch (error) {
        // If getFacebookPages fails with 404, account might not be connected properly
        // Return empty pages instead of requiring tempToken (which is only for OAuth flow)
        if (error instanceof Error && error.message.includes('HTTP 404')) {
          console.warn(`[Getlate Facebook Pages] Account ${accountId} endpoint returned 404. Account may need to be reconnected.`);
          return NextResponse.json({ pages: [] });
        }
        // For other errors, throw them
        throw error;
      }
    }

    return NextResponse.json({ pages });
  } catch (error) {
    console.error('[Getlate Facebook Pages] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pages' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const schema = z.object({
      accountId: z.string().min(1),
      pageId: z.string().min(1),
      pageName: z.string().optional(),
      pageAccessToken: z.string().optional(),
    });

    const parse = schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.message }, { status: 422 });
    }

    const { accountId, pageId, pageName, pageAccessToken } = parse.data;

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Get user's Getlate API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: `Failed to fetch user record: ${userError.message}` },
        { status: 500 },
      );
    }

    if (!userRecord?.getlate_api_key) {
      return NextResponse.json(
        { error: 'Getlate API key not configured. Please connect your Getlate account first.' },
        { status: 400 },
      );
    }

    const getlateApiKey = userRecord.getlate_api_key;

    const { data: socialAccount } = await supabase
      .from('social_accounts')
      .select('id, brand_id, platform_specific_data')
      .eq('getlate_account_id', accountId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!socialAccount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const getlateClient = createGetlateClient(getlateApiKey);
    const existingPlatformData = (socialAccount.platform_specific_data as Record<string, any>) || {};

    // Resolve access token server-side (never rely on client supplied tokens)
    let resolvedAccessToken = pageAccessToken;
    if (!resolvedAccessToken) {
      try {
        const availablePages = await getlateClient.getFacebookPages(accountId);
        const matchingPage = availablePages.find(
          page => page.pageId === pageId || page.id === pageId,
        );
        resolvedAccessToken = matchingPage?.accessToken;
      } catch {
        // swallow, we'll try raw accounts next
      }
    }

    if (!resolvedAccessToken) {
      try {
        const brandQuery = await supabase
          .from('brands')
          .select('getlate_profile_id')
          .eq('id', socialAccount.brand_id)
          .maybeSingle();

        if (brandQuery.data?.getlate_profile_id) {
          const rawAccounts = await getlateClient.getRawAccounts(brandQuery.data.getlate_profile_id);
          const rawFacebookAccount = rawAccounts.find(
            (acc: any) => (acc._id || acc.id) === accountId && acc.platform === 'facebook',
          );
          const availablePages = rawFacebookAccount?.availablePages || rawFacebookAccount?.available_pages || [];
          const matchingPage = (availablePages as any[]).find((page) => {
            const candidateId = page._id || page.id || page.pageId || page.facebookPageId;
            return candidateId === pageId || page.pageId === pageId;
          });
          resolvedAccessToken = matchingPage?.pageAccessToken
            || matchingPage?.page_access_token
            || matchingPage?.accessToken
            || matchingPage?.access_token;
        }
      } catch {
        // ignore – selectFacebookPage may still succeed without explicit token
      }
    }

    await getlateClient.selectFacebookPage(accountId, {
      pageId,
      pageName,
      pageAccessToken: resolvedAccessToken,
    });

    const updatedData = {
      ...existingPlatformData,
      facebookPage: {
        id: pageId,
        name: pageName || existingPlatformData.facebookPage?.name || '',
        updatedAt: new Date().toISOString(),
      },
    };

    const { error: updateError } = await supabase
      .from('social_accounts')
      .update({
        platform_specific_data: updatedData,
      })
      .eq('id', socialAccount.id);

    if (updateError) {
      console.error('[Getlate Facebook Pages] Failed to update account metadata:', updateError);
    }

    // Sync accounts from Getlate API to get updated followers count for the new page
    if (socialAccount.brand_id) {
      // Trigger sync in background (don't await to avoid blocking response)
      fetch(`${request.nextUrl.origin}/api/getlate/accounts?brandId=${socialAccount.brand_id}`, {
        method: 'GET',
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      }).catch(() => {
        // Ignore sync errors - page selection is still successful
      });
    }

    return NextResponse.json({
      page: {
        id: pageId,
        name: pageName,
      },
    });
  } catch (error) {
    console.error('[Getlate Facebook Pages] Error saving selection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save selection' },
      { status: 500 },
    );
  }
}
