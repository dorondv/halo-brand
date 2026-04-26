import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

function extractFollowerCountFromPage(page: Record<string, unknown> | undefined): number | undefined {
  if (!page) {
    return undefined;
  }

  const candidates = [
    page.followersCount,
    page.followerCount,
    page.followers,
    page.fan_count,
    page.fans,
    page.likes,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return undefined;
}

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

    // Get user's Publishing integration API key
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

    // Zernio: GET /v1/accounts/{accountId}/facebook-page — canonical list for connected accounts
    try {
      const apiPages = await getlateClient.getFacebookPages(accountId);
      if (apiPages.length > 0) {
        return NextResponse.json({ pages: apiPages });
      }
    } catch (primaryError) {
      console.error('[Getlate Facebook Pages] GET /accounts/.../facebook-page failed:', primaryError);
      if (primaryError instanceof Error && !primaryError.message.includes('HTTP 404')) {
        throw primaryError;
      }
    }

    // Fallback: embedded availablePages on raw profile accounts (older payloads)
    let pages: Awaited<ReturnType<typeof getlateClient.getFacebookPages>> = [];

    try {
      const rawAccounts = await getlateClient.getRawAccounts(brandRecord.getlate_profile_id);

      const rawFacebookAccount = rawAccounts.find(
        (acc: any) => {
          const accId = acc._id || acc.id;
          return (accId === accountId || String(accId) === String(accountId)) && acc.platform === 'facebook';
        },
      );

      if (rawFacebookAccount) {
        let availablePages = rawFacebookAccount.availablePages
          || rawFacebookAccount.available_pages
          || (rawFacebookAccount.metadata as any)?.availablePages
          || (rawFacebookAccount.metadata as any)?.available_pages
          || (rawFacebookAccount.platform_specific_data as any)?.availablePages
          || (rawFacebookAccount.platform_specific_data as any)?.available_pages;

        if (!availablePages && rawFacebookAccount.metadata && typeof rawFacebookAccount.metadata === 'object') {
          const metadata = rawFacebookAccount.metadata as any;
          availablePages = metadata.availablePages || metadata.available_pages;
        }

        if (availablePages && Array.isArray(availablePages) && availablePages.length > 0) {
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
            return NextResponse.json({ pages });
          }
        }
      } else {
        console.warn(`[Getlate Facebook Pages] Facebook account with ID ${accountId} not found in raw accounts`);
      }
    } catch (fetchError) {
      console.error('[Getlate Facebook Pages] Error fetching raw accounts from Getlate:', fetchError);
    }

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
        console.warn(`[Getlate Facebook Pages] Account ${accountId} exists but has no pages in API or cached availablePages.`);
      }
    } catch (verifyError) {
      console.error('[Getlate Facebook Pages] Error verifying account:', verifyError);
    }

    return NextResponse.json({ pages: [] });
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

    // Get user's Publishing integration API key
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

    // Zernio: PUT /v1/accounts/{accountId}/facebook-page — body { selectedPageId }
    const selectResponse = await getlateClient.selectFacebookPage(accountId, {
      pageId,
      pageName,
      pageAccessToken,
    });

    const apiSelectedName = selectResponse?.selectedPage?.name;
    let displayName = pageName || apiSelectedName || (existingPlatformData.facebookPage?.name as string) || '';
    let selectedPageFollowerCount: number | undefined;

    try {
      const listed = await getlateClient.getFacebookPages(accountId);
      const matchingPage = listed.find(
        p => (p.pageId || p.id) === pageId,
      );
      if (matchingPage) {
        if (!displayName && matchingPage.name) {
          displayName = matchingPage.name;
        }
        const meta = matchingPage.metadata as Record<string, unknown> | undefined;
        if (typeof meta?.fan_count === 'number') {
          selectedPageFollowerCount = meta.fan_count;
        } else {
          selectedPageFollowerCount = extractFollowerCountFromPage(matchingPage as unknown as Record<string, unknown>);
        }
      }
    } catch {
      // ignore — UI still has page id; sync may fill counts
    }

    const updatedData = {
      ...existingPlatformData,
      ...(typeof selectedPageFollowerCount === 'number'
        ? { follower_count: selectedPageFollowerCount }
        : {}),
      facebookPage: {
        id: pageId,
        name: displayName,
        ...(typeof selectedPageFollowerCount === 'number'
          ? { follower_count: selectedPageFollowerCount }
          : {}),
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

    // Sync accounts from Publishing integration API to get updated followers count for the new page
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
        name: displayName,
      },
      followerCount: selectedPageFollowerCount,
    });
  } catch (error) {
    console.error('[Getlate Facebook Pages] Error saving selection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save selection' },
      { status: 500 },
    );
  }
}
