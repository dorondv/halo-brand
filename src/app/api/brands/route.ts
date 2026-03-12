import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Env } from '@/libs/Env';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * DELETE /api/brands
 * Delete a brand and its associated Getlate profile
 */
export async function DELETE(request: NextRequest) {
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

    // Verify brand belongs to user
    const { data: brandRecord, error: brandError } = await supabase
      .from('brands')
      .select('id, getlate_profile_id, user_id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brandRecord) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Check if brand has any active connected accounts
    // User must disconnect all accounts before deleting the brand
    const { data: connectedAccounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('id, platform, account_name')
      .eq('brand_id', brandId)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (accountsError) {
      console.error('Error checking connected accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to check connected accounts' },
        { status: 500 },
      );
    }

    if (connectedAccounts && connectedAccounts.length > 0) {
      const accountCount = connectedAccounts.length;
      const accountList = connectedAccounts
        .map(acc => `${acc.platform}: ${acc.account_name || 'Unknown'}`)
        .join(', ');

      return NextResponse.json(
        {
          error: 'Cannot delete brand with connected accounts',
          message: `Please disconnect all ${accountCount} connected account${accountCount > 1 ? 's' : ''} before deleting this brand: ${accountList}`,
          accounts: connectedAccounts.map(acc => ({
            id: acc.id,
            platform: acc.platform,
            account_name: acc.account_name,
          })),
        },
        { status: 400 },
      );
    }

    // Get user record to fetch API key
    const { data: userRecord } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    // Delete Getlate profile if it exists
    if (brandRecord.getlate_profile_id && userRecord?.getlate_api_key) {
      try {
        const profileId = brandRecord.getlate_profile_id;
        const getlateClient = createGetlateClient(userRecord.getlate_api_key);

        // First, check Getlate directly for connected accounts
        // This is important because accounts might exist in Getlate but not in our database
        const getlateAccounts = await getlateClient.getAccounts(profileId);

        // Filter for active/connected accounts
        const activeGetlateAccounts = getlateAccounts.filter(
          acc => acc.isActive !== false && acc.isConnected !== false,
        );

        if (activeGetlateAccounts.length > 0) {
          const accountList = activeGetlateAccounts
            .map(acc => `${acc.platform}: ${acc.accountName || acc.username || 'Unknown'}`)
            .join(', ');

          console.warn(`[Brand Deletion] Found ${activeGetlateAccounts.length} connected account(s) in Getlate: ${accountList}`);

          return NextResponse.json(
            {
              error: 'Cannot delete brand with connected accounts in Getlate',
              message: `This profile has ${activeGetlateAccounts.length} connected account${activeGetlateAccounts.length > 1 ? 's' : ''} in Getlate that must be disconnected first: ${accountList}`,
              accounts: activeGetlateAccounts.map(acc => ({
                platform: acc.platform,
                accountName: acc.accountName || acc.username,
                id: acc._id || acc.id,
              })),
              note: 'These accounts may exist in Getlate but not in your local database. Please disconnect them in Getlate first.',
            },
            { status: 400 },
          );
        }

        // Delete the Getlate profile using the client
        await getlateClient.deleteProfile(profileId);
      } catch (error) {
        // Log the full error for debugging
        console.error('❌ Error deleting Getlate profile:', {
          profileId: brandRecord.getlate_profile_id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Check if error is about connected accounts
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('connected accounts') || errorMessage.includes('Cannot delete profile')) {
          // Return a proper error response instead of continuing
          return NextResponse.json(
            {
              error: 'Cannot delete Getlate profile',
              message: errorMessage,
              note: 'Please disconnect all accounts from this profile in Getlate before deleting the brand.',
            },
            { status: 400 },
          );
        }

        // If delete fails for other reasons, we still want to delete the brand from our database
        // but we should log this as an error, not just a warning
        // The profile will remain in Getlate but will be unlinked from the brand
        console.warn('⚠️  Brand will be deleted from database, but Getlate profile deletion failed. Profile may still exist in Getlate.');
        // Continue with brand deletion even if Getlate profile deletion fails
      }
    }

    // Delete the brand (this will cascade delete related records if foreign keys are set up)
    const { error: deleteError } = await supabase
      .from('brands')
      .delete()
      .eq('id', brandId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting brand:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete brand' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete brand' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/brands
 * Create a new brand with automatic Getlate profile management
 * - Reuses existing unused Getlate profiles if available
 * - Creates new Getlate profile if none available
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const Schema = z.object({
      name: z.string().min(1).max(255).trim(),
      description: z.string().max(1000).optional().nullable().transform(val => val?.trim() || null),
      logo_url: z.string().url().max(2048).optional().nullable(),
    });

    const parse = Schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 422 });
    }

    const { name, description, logo_url } = parse.data;

    const { getUserSubscription, getSubscriptionPlan } = await import('@/libs/subscriptionService');
    const { brands: brandsTable } = await import('@/models/Schema');
    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/libs/DB');

    const subscription = await getUserSubscription(user.id);
    let maxBrands = 1;

    if (subscription && subscription.planType !== 'free') {
      const now = new Date();
      const isSubscriptionActive = subscription.status === 'active' || subscription.status === 'trialing';
      const isNotExpired = !subscription.endDate || new Date(subscription.endDate) > now;

      if (isSubscriptionActive && isNotExpired) {
        const plan = await getSubscriptionPlan(subscription.planType as 'basic' | 'pro' | 'business');
        if (plan) {
          maxBrands = plan.maxBrands || 999999;
        } else {
          maxBrands = subscription.planType === 'basic' ? 1 : subscription.planType === 'pro' ? 10 : 50;
        }
      }
    }

    const existingBrandsCount = await db
      .select({ count: brandsTable.id })
      .from(brandsTable)
      .where(eq(brandsTable.userId, user.id));

    const currentBrandCount = existingBrandsCount.length;

    if (currentBrandCount >= maxBrands) {
      return NextResponse.json(
        {
          error: `You've reached your brand limit (${maxBrands}). ${maxBrands === 1 ? 'Upgrade your plan to create more brands.' : 'Please upgrade your plan to create more brands.'}`,
        },
        { status: 403 },
      );
    }

    // Get user record to fetch API key
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, getlate_api_key')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Auto-setup integration if not configured
    if (!userRecord.getlate_api_key) {
      const serviceApiKey = Env.GETLATE_SERVICE_API_KEY;
      if (!serviceApiKey) {
        console.error('GETLATE_SERVICE_API_KEY not configured');
        return NextResponse.json(
          { error: 'Integration service not configured' },
          { status: 500 },
        );
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ getlate_api_key: serviceApiKey })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error saving API key:', updateError);
        return NextResponse.json(
          { error: 'Failed to initialize integration' },
          { status: 500 },
        );
      }

      userRecord.getlate_api_key = serviceApiKey;
    }

    // Always create a new Getlate profile for each brand
    let getlateProfileId: string | null = null;

    if (userRecord.getlate_api_key) {
      try {
        const getlateClient = createGetlateClient(userRecord.getlate_api_key);

        // Always create a new profile with the brand name
        const newProfile = await getlateClient.createProfile(name);

        // Getlate API may return _id or id, handle both formats
        // Also check if the response is nested
        const extractedProfileId = (newProfile as any)?._id
          || (newProfile as any)?.id
          || newProfile?.id
          || newProfile?._id;

        if (!extractedProfileId) {
          console.error('[Brand Creation] Created profile but missing ID. Full response:', JSON.stringify(newProfile, null, 2));
          // Try to fetch profiles again to see if it was created
          try {
            const profilesAfterCreate = await getlateClient.getProfiles();
            let allProfilesAfter: any[] = [];
            if (Array.isArray(profilesAfterCreate)) {
              allProfilesAfter = profilesAfterCreate;
            } else if (profilesAfterCreate && typeof profilesAfterCreate === 'object') {
              allProfilesAfter = (profilesAfterCreate as any)?.profiles
                || (profilesAfterCreate as any)?.data
                || (profilesAfterCreate as any)?.results
                || [];
            }

            // Find the profile we just created by name (most recent match)
            const createdProfile = allProfilesAfter
              .filter((p: any) => p && (p.name === name || p.name?.includes(name)))
              .sort((a: any, b: any) => {
                // Sort by created_at if available, otherwise by _id (newer IDs might be later)
                const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                return bTime - aTime; // Most recent first
              })[0];

            if (createdProfile) {
              getlateProfileId = createdProfile._id || createdProfile.id;
            } else {
              throw new Error('Created Getlate profile but could not find it in profiles list');
            }
          } catch (fetchError) {
            console.error('[Brand Creation] Error fetching profiles after creation:', fetchError);
            throw new Error('Created Getlate profile but response missing ID and could not verify creation');
          }
        } else {
          getlateProfileId = extractedProfileId;
        }
      } catch (error) {
        console.error('[Brand Creation] Error creating Getlate profile:', error);
        // Log full error details for debugging
        if (error instanceof Error) {
          console.error('[Brand Creation] Error details:', {
            message: error.message,
            stack: error.stack,
          });
        }
        // Continue without Getlate profile - brand will be created without it
        // User can link it later via the connections page
      }
    }

    // Verify profile exists if we have a profile ID
    if (getlateProfileId && userRecord?.getlate_api_key) {
      try {
        const getlateClient = createGetlateClient(userRecord.getlate_api_key);
        const verifyProfiles = await getlateClient.getProfiles();
        let allProfilesVerify: any[] = [];
        if (Array.isArray(verifyProfiles)) {
          allProfilesVerify = verifyProfiles;
        } else if (verifyProfiles && typeof verifyProfiles === 'object') {
          allProfilesVerify = (verifyProfiles as any)?.profiles
            || (verifyProfiles as any)?.data
            || (verifyProfiles as any)?.results
            || [];
        }

        const profileDetails = allProfilesVerify.find(
          (p: any) => (p._id || p.id) === getlateProfileId,
        );

        if (!profileDetails) {
          console.warn(`[Brand Creation] ⚠️ Profile ${getlateProfileId} not found in Getlate profiles list`);
        }
      } catch (verifyError) {
        console.warn('[Brand Creation] Could not verify profile existence:', verifyError);
      }
    }

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert([
        {
          user_id: user.id,
          name: name.trim(),
          description: description ? description.trim() : null,
          logo_url: logo_url || null,
          getlate_profile_id: getlateProfileId,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (brandError) {
      console.error('Error creating brand:', brandError);
      return NextResponse.json(
        { error: 'Failed to create brand' },
        { status: 500 },
      );
    }

    // Verify the profile ID was saved correctly
    if (brand && getlateProfileId && userRecord?.getlate_api_key) {
      // Double-check the profile exists in Getlate
      try {
        const getlateClient = createGetlateClient(userRecord.getlate_api_key);
        const verifyProfiles = await getlateClient.getProfiles();
        let allProfilesVerify: any[] = [];
        if (Array.isArray(verifyProfiles)) {
          allProfilesVerify = verifyProfiles;
        } else if (verifyProfiles && typeof verifyProfiles === 'object') {
          allProfilesVerify = (verifyProfiles as any)?.profiles
            || (verifyProfiles as any)?.data
            || (verifyProfiles as any)?.results
            || [];
        }

        const profileExists = allProfilesVerify.some(
          (p: any) => (p._id || p.id) === getlateProfileId,
        );

        if (!profileExists) {
          console.warn(`[Brand Creation] WARNING: Profile ${getlateProfileId} not found in Getlate profiles list after creation`);
        }
      } catch (verifyError) {
        console.warn('[Brand Creation] Could not verify profile existence:', verifyError);
      }
    }

    return NextResponse.json({ brand });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create brand' },
      { status: 500 },
    );
  }
}
