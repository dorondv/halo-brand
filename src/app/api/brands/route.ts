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

        // Delete the Getlate profile using the client
        await getlateClient.deleteProfile(profileId);
      } catch (error) {
        // Log the full error for debugging
        console.error('❌ Error deleting Getlate profile:', {
          profileId: brandRecord.getlate_profile_id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // If delete fails, we still want to delete the brand from our database
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

    const body = await request.json().catch(() => ({}));
    const Schema = z.object({
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      logo_url: z.string().url().optional().nullable(),
    });

    const parse = Schema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.message }, { status: 422 });
    }

    const { name, description, logo_url } = parse.data;

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

    // Check for unused Getlate profiles (profiles not linked to any active brand)
    let getlateProfileId: string | null = null;

    // Special case: demo@hello.brand should use the default profile for the first brand
    const isDemoUser = user.email === 'demo@hello.brand';
    const DEFAULT_GETLATE_PROFILE_ID = '690c738f2e6c6b55e66c14e6';

    // Check if this is the first brand in the entire system
    const { count: totalBrandsCount } = await supabase
      .from('brands')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const isFirstBrandInSystem = (totalBrandsCount || 0) === 0;

    if (userRecord.getlate_api_key) {
      try {
        const getlateClient = createGetlateClient(userRecord.getlate_api_key);

        // If this is the first brand in the system, use the first existing Getlate profile
        if (isFirstBrandInSystem) {
          try {
            const profilesResponse = await getlateClient.getProfiles();

            // Handle both array and object response formats
            let allProfiles: any[] = [];
            if (Array.isArray(profilesResponse)) {
              allProfiles = profilesResponse;
            } else if (profilesResponse && typeof profilesResponse === 'object') {
              // Try to extract from common response formats
              allProfiles = (profilesResponse as any)?.profiles
                || (profilesResponse as any)?.data
                || (profilesResponse as any)?.results
                || [];
            }

            if (Array.isArray(allProfiles) && allProfiles.length > 0) {
              // Use the first existing profile (Getlate API uses _id format)
              const firstProfile = allProfiles[0];
              if (firstProfile) {
                // Getlate API returns _id, but we'll handle both formats
                getlateProfileId = firstProfile._id || firstProfile.id;
              }
            }
          } catch (error) {
            console.warn('Could not fetch Getlate profiles for first brand, will create new one:', error);
          }
        }

        // Check if this is the first brand for demo user
        if (isDemoUser && !getlateProfileId) {
          const { data: existingBrands } = await supabase
            .from('brands')
            .select('getlate_profile_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .not('getlate_profile_id', 'is', null);

          // If no brands have the default profile yet, use it
          const hasDefaultProfile = existingBrands?.some(
            b => b.getlate_profile_id === DEFAULT_GETLATE_PROFILE_ID,
          );

          if (!hasDefaultProfile) {
            // Verify the default profile exists
            try {
              const profilesResponse = await getlateClient.getProfiles();

              // Handle both array and object response formats
              let allProfiles: any[] = [];
              if (Array.isArray(profilesResponse)) {
                allProfiles = profilesResponse;
              } else if (profilesResponse && typeof profilesResponse === 'object') {
                // Try to extract from common response formats
                allProfiles = (profilesResponse as any)?.profiles
                  || (profilesResponse as any)?.data
                  || (profilesResponse as any)?.results
                  || [];
              }

              if (Array.isArray(allProfiles) && allProfiles.length > 0) {
                const defaultProfile = allProfiles.find(
                  p => p && (p.id === DEFAULT_GETLATE_PROFILE_ID || p._id === DEFAULT_GETLATE_PROFILE_ID),
                );
                if (defaultProfile) {
                  getlateProfileId = DEFAULT_GETLATE_PROFILE_ID;
                }
              }
            } catch (error) {
              console.warn('Could not verify default profile, will create new one:', error);
            }
          }
        }

        // If we don't have a profile yet, check for unused or create new
        if (!getlateProfileId) {
          try {
            const profilesResponse = await getlateClient.getProfiles();

            // Debug logging

            // Handle both array and object response formats
            let allProfiles: any[] = [];
            if (Array.isArray(profilesResponse)) {
              allProfiles = profilesResponse;
            } else if (profilesResponse && typeof profilesResponse === 'object') {
              // Try to extract from common response formats
              allProfiles = (profilesResponse as any)?.profiles
                || (profilesResponse as any)?.data
                || (profilesResponse as any)?.results
                || [];
            }

            // Validate we have an array
            if (!Array.isArray(allProfiles)) {
              console.error('Getlate API returned invalid profiles format:', {
                type: typeof profilesResponse,
                response: JSON.stringify(profilesResponse).substring(0, 200),
              });
              throw new Error('Invalid response format from Getlate API: expected array or object with profiles/data property');
            }

            // Get all active brands for this user to see which profiles are in use
            const { data: existingBrands } = await supabase
              .from('brands')
              .select('getlate_profile_id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .not('getlate_profile_id', 'is', null);

            const usedProfileIds = new Set(
              existingBrands?.map(b => b.getlate_profile_id).filter(Boolean) || [],
            );

            // Find an unused profile
            // For demo users, skip the default profile (already handled above)
            // For other users, any unused profile is fine
            // Double-check we have an array before calling .find()
            const unusedProfile = Array.isArray(allProfiles) && allProfiles.length > 0
              ? allProfiles.find(
                  (profile) => {
                    const profileId = profile?._id || profile?.id;
                    return profileId
                      && !usedProfileIds.has(profileId)
                      && (isDemoUser ? profileId !== DEFAULT_GETLATE_PROFILE_ID : true);
                  },
                )
              : null;

            if (unusedProfile) {
              // Reuse existing unused profile (Getlate API uses _id format)
              getlateProfileId = unusedProfile._id || unusedProfile.id;
            } else {
              // Create new Getlate profile
              const newProfile = await getlateClient.createProfile(name);
              // Getlate API may return _id or id, handle both
              const extractedProfileId = newProfile._id || newProfile.id;
              if (!extractedProfileId) {
                console.error('Created profile but missing ID:', newProfile);
                throw new Error('Created Getlate profile but response missing ID');
              }
              getlateProfileId = extractedProfileId;
            }
          } catch (error) {
            console.error('Error managing Getlate profile:', error);
            // Continue without Getlate profile - brand will be created without it
            // User can link it later via the connections page
          }
        }
      } catch (error) {
        console.error('Error managing Getlate profile:', error);
        // Continue without Getlate profile - brand will be created without it
        // User can link it later via the connections page
      }
    }

    // Create brand with Getlate profile ID
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert([
        {
          user_id: user.id,
          name,
          description: description || null,
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

    return NextResponse.json({ brand });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create brand' },
      { status: 500 },
    );
  }
}
