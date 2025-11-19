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

    let supabase;
    try {
      supabase = await createSupabaseServerClient();
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Failed to create Supabase client:', error);
      return NextResponse.json(
        { error: 'Failed to initialize database connection' },
        { status: 500 },
      );
    }

    let user;
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
      }
      user = authUser;
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Auth error:', error);
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 500 },
      );
    }

    // Get user's Getlate API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[Getlate LinkedIn Organizations] Failed to fetch user record:', userError);
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

    let socialAccount;
    try {
      const { data, error: queryError } = await supabase
        .from('social_accounts')
        .select('id, brand_id, platform_specific_data, getlate_account_id')
        .eq('getlate_account_id', accountId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (queryError) {
        console.error('[Getlate LinkedIn Organizations] Database query error:', queryError);
        return NextResponse.json(
          { error: 'Failed to fetch account from database' },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      socialAccount = data;
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Database error:', error);
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 },
      );
    }

    let brandRecord;
    try {
      const { data, error: queryError } = await supabase
        .from('brands')
        .select('getlate_profile_id')
        .eq('id', socialAccount.brand_id)
        .maybeSingle();

      if (queryError) {
        console.error('[Getlate LinkedIn Organizations] Brand query error:', queryError);
        return NextResponse.json(
          { error: 'Failed to fetch brand from database' },
          { status: 500 },
        );
      }

      if (!data?.getlate_profile_id) {
        return NextResponse.json(
          { error: 'Brand not linked to a Getlate profile' },
          { status: 400 },
        );
      }

      brandRecord = data;
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Brand database error:', error);
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 },
      );
    }

    const getlateClient = createGetlateClient(getlateApiKey);

    // Step 1: Fetch accounts from Getlate API using profileId
    // GET /v1/accounts?profileId=PROFILE_ID
    const rawAccounts = await getlateClient.getRawAccounts(brandRecord.getlate_profile_id);

    // Step 2: Find the LinkedIn account from the Getlate API response
    // Match by the stored getlate_account_id or by username/accountName
    const linkedInAccount = rawAccounts.find(
      (acc: any) => {
        const accountIdFromApi = acc._id || acc.id;
        // Match by stored account ID
        if (accountIdFromApi === accountId && acc.platform === 'linkedin') {
          return true;
        }
        // Also try matching by username if available
        if (acc.platform === 'linkedin' && socialAccount.platform_specific_data) {
          const platformData = socialAccount.platform_specific_data as Record<string, unknown>;
          const accountName = platformData.accountName || platformData.username;
          if (accountName && (acc.username === accountName || acc.accountName === accountName)) {
            return true;
          }
        }
        return false;
      },
    );

    if (!linkedInAccount) {
      return NextResponse.json(
        { error: 'LinkedIn account not found in Getlate' },
        { status: 404 },
      );
    }

    // Step 3: Use the account ID from Getlate API response (id or _id)
    const getlateAccountId = linkedInAccount._id || linkedInAccount.id;
    if (!getlateAccountId) {
      return NextResponse.json(
        { error: 'Invalid account ID from Getlate API' },
        { status: 500 },
      );
    }

    // Try to get accessToken to use as tempToken directly from Getlate
    const tempToken = linkedInAccount.accessToken
      || linkedInAccount.tempToken
      || linkedInAccount.access_token
      || linkedInAccount.temp_token
      || (linkedInAccount.metadata as Record<string, unknown> | undefined)?.accessToken as string | undefined
      || (linkedInAccount.metadata as Record<string, unknown> | undefined)?.tempToken as string | undefined
      || (linkedInAccount.metadata as Record<string, unknown> | undefined)?.access_token as string | undefined
      || undefined;

    // Step 4: Use the account ID from Getlate API to fetch organizations
    // GET /v1/accounts/[accountId]/linkedin-organizations
    let organizations: Awaited<ReturnType<typeof getlateClient.getLinkedInOrganizations>> = [];
    try {
      organizations = await getlateClient.getLinkedInOrganizations(getlateAccountId, tempToken);
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTP 404')) {
        organizations = [];
      } else {
        throw error;
      }
    }

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('[Getlate LinkedIn Organizations] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch organizations' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const schema = z.object({
      accountId: z.string().min(1),
      organizationId: z.string().min(1),
      organizationName: z.string().optional(),
      organizationUrn: z.string().optional(),
      sourceUrl: z.string().url().optional(),
    });

    const parse = schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.message }, { status: 422 });
    }

    const {
      accountId,
      organizationId,
      organizationName,
      organizationUrn,
      sourceUrl,
    } = parse.data;

    let supabase;
    try {
      supabase = await createSupabaseServerClient();
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Failed to create Supabase client:', error);
      return NextResponse.json(
        { error: 'Failed to initialize database connection' },
        { status: 500 },
      );
    }

    let user;
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
      }
      user = authUser;
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Auth error:', error);
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 500 },
      );
    }

    // Get user's Getlate API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[Getlate LinkedIn Organizations] Failed to fetch user record:', userError);
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

    let socialAccount;
    try {
      const { data, error: queryError } = await supabase
        .from('social_accounts')
        .select('id, brand_id, platform_specific_data, getlate_account_id')
        .eq('getlate_account_id', accountId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (queryError) {
        console.error('[Getlate LinkedIn Organizations] Database query error:', queryError);
        return NextResponse.json(
          { error: 'Failed to fetch account from database' },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      socialAccount = data;
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Database error:', error);
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 },
      );
    }

    let brandRecord;
    try {
      const { data, error: queryError } = await supabase
        .from('brands')
        .select('getlate_profile_id')
        .eq('id', socialAccount.brand_id)
        .maybeSingle();

      if (queryError) {
        console.error('[Getlate LinkedIn Organizations] Brand query error:', queryError);
        return NextResponse.json(
          { error: 'Failed to fetch brand from database' },
          { status: 500 },
        );
      }

      if (!data?.getlate_profile_id) {
        return NextResponse.json(
          { error: 'Brand not linked to a Getlate profile' },
          { status: 400 },
        );
      }

      brandRecord = data;
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Brand database error:', error);
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 },
      );
    }

    const getlateClient = createGetlateClient(getlateApiKey);

    // Fetch accounts from Getlate API to get the correct account ID
    const rawAccounts = await getlateClient.getRawAccounts(brandRecord.getlate_profile_id);

    // Find the LinkedIn account from the Getlate API response
    const linkedInAccount = rawAccounts.find(
      (acc: any) => {
        const accountIdFromApi = acc._id || acc.id;
        if (accountIdFromApi === accountId && acc.platform === 'linkedin') {
          return true;
        }
        // Also try matching by username if available
        if (acc.platform === 'linkedin' && socialAccount.platform_specific_data) {
          const platformData = socialAccount.platform_specific_data as Record<string, unknown>;
          const accountName = platformData.accountName || platformData.username;
          if (accountName && (acc.username === accountName || acc.accountName === accountName)) {
            return true;
          }
        }
        return false;
      },
    );

    if (!linkedInAccount) {
      return NextResponse.json(
        { error: 'LinkedIn account not found in Getlate' },
        { status: 404 },
      );
    }

    // Use the account ID from Getlate API response
    const getlateAccountId = linkedInAccount._id || linkedInAccount.id;
    if (!getlateAccountId) {
      return NextResponse.json(
        { error: 'Invalid account ID from Getlate API' },
        { status: 500 },
      );
    }

    await getlateClient.selectLinkedInOrganization(getlateAccountId, {
      organizationId,
      organizationName,
      organizationUrn,
      sourceUrl,
    });

    const platformData = (socialAccount.platform_specific_data as Record<string, any>) || {};
    const updatedData = {
      ...platformData,
      linkedinOrganization: {
        id: organizationId,
        name: organizationName || platformData.linkedinOrganization?.name || '',
        urn: organizationUrn || platformData.linkedinOrganization?.urn,
        sourceUrl: sourceUrl || platformData.linkedinOrganization?.sourceUrl,
        updatedAt: new Date().toISOString(),
      },
    };

    try {
      const { error: updateError } = await supabase
        .from('social_accounts')
        .update({
          platform_specific_data: updatedData,
        })
        .eq('id', socialAccount.id);

      if (updateError) {
        console.error('[Getlate LinkedIn Organizations] Failed to update account metadata:', updateError);
        // Don't fail the request if update fails, just log it
      }
    } catch (error) {
      console.error('[Getlate LinkedIn Organizations] Database update error:', error);
      // Don't fail the request if update fails, just log it
    }

    return NextResponse.json({
      organization: {
        id: organizationId,
        name: organizationName,
        urn: organizationUrn,
      },
    });
  } catch (error) {
    console.error('[Getlate LinkedIn Organizations] Error saving selection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save selection' },
      { status: 500 },
    );
  }
}
