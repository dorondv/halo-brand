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
      const rawFacebookAccount = rawAccounts.find(
        (acc: any) => (acc._id || acc.id) === accountId && acc.platform === 'facebook',
      );

      if (rawFacebookAccount) {
        // Get availablePages (like in getlate-test page)
        const availablePages = rawFacebookAccount.availablePages || rawFacebookAccount.available_pages;

        if (availablePages && Array.isArray(availablePages) && availablePages.length > 0) {
          // availablePages already contains the pages list - use it directly
          // Map availablePages to GetlateFacebookPage format
          pages = availablePages.map((page: any) => ({
            id: page._id || page.id || page.pageId || page.facebookPageId,
            name: page.name || page.pageName || page.title || 'Page',
            pageId: page.pageId || page.facebookPageId || page.id,
            pageName: page.pageName || page.name || page.title,
            pictureUrl: page.picture?.data?.url || page.pictureUrl || page.logoUrl,
            metadata: page.metadata || {},
          })).filter(page => !!page.id && !!page.name);

          // Return pages from availablePages
          return NextResponse.json({ pages });
        }
      }
    } catch (fetchError) {
      console.error('[Getlate Facebook Pages] Error fetching accounts from Getlate:', fetchError);
      // Continue to fallback methods
    }

    // Fallback: Try account-specific endpoint (doesn't require tempToken)
    if (pages.length === 0) {
      try {
        pages = await getlateClient.getFacebookPages(accountId);
        if (pages.length > 0) {
          return NextResponse.json({ pages });
        }
      } catch (error) {
        // Continue to OAuth flow method
        if (!(error instanceof Error && error.message.includes('HTTP 404'))) {
          throw error;
        }
      }
    }

    // Fallback: Try OAuth flow method with tempToken
    if (pages.length === 0) {
      let tempToken: string | undefined;

      try {
        const rawAccounts = await getlateClient.getRawAccounts(brandRecord.getlate_profile_id);
        const rawFacebookAccount = rawAccounts.find(
          (acc: any) => (acc._id || acc.id) === accountId && acc.platform === 'facebook',
        );

        if (rawFacebookAccount) {
          tempToken = rawFacebookAccount.accessToken
            || rawFacebookAccount.tempToken
            || rawFacebookAccount.access_token
            || rawFacebookAccount.temp_token
            || (rawFacebookAccount.metadata as Record<string, unknown> | undefined)?.accessToken as string | undefined
            || (rawFacebookAccount.metadata as Record<string, unknown> | undefined)?.tempToken as string | undefined
            || (rawFacebookAccount.metadata as Record<string, unknown> | undefined)?.access_token as string | undefined
            || undefined;
        }
      } catch (fetchError) {
        console.error('[Getlate Facebook Pages] Error fetching account from Getlate:', fetchError);
      }

      if (tempToken) {
        try {
          pages = await getlateClient.getFacebookSelectPage(brandRecord.getlate_profile_id, tempToken);
        } catch (selectError) {
          if (selectError instanceof Error && selectError.message.includes('HTTP 404')) {
            pages = [];
          } else {
            throw selectError;
          }
        }
      } else {
        return NextResponse.json(
          { error: 'Temporary token missing. Please reconnect the account to refresh permissions.' },
          { status: 400 },
        );
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
