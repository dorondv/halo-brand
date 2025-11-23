import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createGetlateClient } from '@/libs/Getlate';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * GET /api/getlate/profiles
 * Get all Getlate profiles for the authenticated user
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
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

    // Fetch profiles from Getlate
    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    const profiles = await getlateClient.getProfiles();

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error fetching Getlate profiles:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profiles' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/getlate/profiles
 * Create a new Getlate profile and link it to a brand
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, brandId } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Profile name is required' }, { status: 422 });
    }

    if (!brandId || typeof brandId !== 'string') {
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

    // Verify brand belongs to user
    const { data: brandRecord, error: brandError } = await supabase
      .from('brands')
      .select('id, getlate_profile_id')
      .eq('id', brandId)
      .eq('user_id', user.id)
      .single();

    if (brandError || !brandRecord) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // If brand already has a profile, return it
    if (brandRecord.getlate_profile_id) {
      const getlateClient = createGetlateClient(userRecord.getlate_api_key);
      try {
        // Try to get the existing profile to verify it exists
        const allProfilesResponse = await getlateClient.getProfiles();

        // Handle both array and object response formats
        let allProfiles: any[] = [];
        if (Array.isArray(allProfilesResponse)) {
          allProfiles = allProfilesResponse;
        } else if (allProfilesResponse && typeof allProfilesResponse === 'object') {
          allProfiles = (allProfilesResponse as any)?.profiles
            || (allProfilesResponse as any)?.data
            || (allProfilesResponse as any)?.results
            || [];
        }

        const existingProfile = Array.isArray(allProfiles)
          ? allProfiles.find(p => p && p.id === brandRecord.getlate_profile_id)
          : null;

        if (existingProfile) {
          return NextResponse.json({
            profile: existingProfile,
            profileId: existingProfile.id,
            brandId,
          });
        }
      } catch (error) {
        console.warn('Error fetching existing profile, will try to create new one:', error);
      }
    }

    // Create profile in Getlate
    const getlateClient = createGetlateClient(userRecord.getlate_api_key);
    let profile: any;

    try {
      // First, check if a profile with this name already exists
      const allProfilesResponse = await getlateClient.getProfiles();

      // Handle both array and object response formats
      let allProfiles: any[] = [];
      if (Array.isArray(allProfilesResponse)) {
        allProfiles = allProfilesResponse;
      } else if (allProfilesResponse && typeof allProfilesResponse === 'object') {
        allProfiles = (allProfilesResponse as any)?.profiles
          || (allProfilesResponse as any)?.data
          || (allProfilesResponse as any)?.results
          || [];
      }

      // Check if a profile with this name already exists
      const existingProfileByName = Array.isArray(allProfiles)
        ? allProfiles.find(p => p && p.name === name)
        : null;

      if (existingProfileByName) {
        // Check if this profile is already linked to another brand
        const { data: brandsWithProfile } = await supabase
          .from('brands')
          .select('id')
          .eq('getlate_profile_id', existingProfileByName.id)
          .eq('is_active', true);

        if (brandsWithProfile && brandsWithProfile.length > 0) {
          // Profile is already in use, create with a modified name
          const timestamp = Date.now();
          const modifiedName = `${name} (${timestamp})`;
          profile = await getlateClient.createProfile(modifiedName);
        } else {
          // Profile exists but is not linked, reuse it
          // Ensure the profile object has the correct structure
          profile = existingProfileByName;
          if (!profile.id) {
            console.error('Existing profile missing ID:', existingProfileByName);
            // Try to create a new one with modified name instead
            const timestamp = Date.now();
            const modifiedName = `${name} (${timestamp})`;
            profile = await getlateClient.createProfile(modifiedName);
          }
        }
      } else {
        // No profile with this name exists, create new one
        profile = await getlateClient.createProfile(name);
      }
    } catch (error: any) {
      // Handle "already exists" error gracefully
      if (error?.message && error.message.includes('already exists')) {
        // Try to find the existing profile by name
        try {
          const allProfilesResponse = await getlateClient.getProfiles();

          let allProfiles: any[] = [];
          if (Array.isArray(allProfilesResponse)) {
            allProfiles = allProfilesResponse;
          } else if (allProfilesResponse && typeof allProfilesResponse === 'object') {
            allProfiles = (allProfilesResponse as any)?.profiles
              || (allProfilesResponse as any)?.data
              || (allProfilesResponse as any)?.results
              || [];
          }

          const existingProfile = Array.isArray(allProfiles)
            ? allProfiles.find(p => p && p.name === name)
            : null;

          if (existingProfile) {
            // Check if this profile is already linked to another brand
            const { data: brandsWithProfile } = await supabase
              .from('brands')
              .select('id')
              .eq('getlate_profile_id', existingProfile.id)
              .eq('is_active', true);

            if (brandsWithProfile && brandsWithProfile.length > 0) {
              // Profile is in use, return error
              return NextResponse.json(
                { error: 'A profile with this name already exists and is in use' },
                { status: 409 },
              );
            } else {
              // Profile exists but is not linked, reuse it
              // Ensure the profile object has the correct structure
              profile = existingProfile;
              if (!profile || !profile.id) {
                console.error('Existing profile missing ID:', existingProfile);
                throw error; // Re-throw original error if profile is invalid
              }
            }
          } else {
            throw error; // Re-throw if we can't find it
          }
        } catch (findError) {
          console.error('Error finding existing profile:', findError);
          throw error; // Re-throw original error
        }
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

    // Link profile to brand
    const { error: updateError } = await supabase
      .from('brands')
      .update({ getlate_profile_id: profile.id })
      .eq('id', brandId);

    if (updateError) {
      console.error('Error linking Getlate profile to brand:', updateError);
      return NextResponse.json(
        { error: 'Failed to link profile to brand' },
        { status: 500 },
      );
    }

    // Ensure profile has an ID before returning
    if (!profile || !profile.id) {
      console.error('Profile missing ID:', profile);
      return NextResponse.json(
        { error: 'Profile created but missing ID' },
        { status: 500 },
      );
    }

    // Return the profile with the brand ID for convenience
    return NextResponse.json({
      profile,
      profileId: profile.id, // Include profile ID for easy access
      brandId, // Include brand ID for confirmation
    });
  } catch (error) {
    console.error('Error creating Getlate profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create profile' },
      { status: 500 },
    );
  }
}
