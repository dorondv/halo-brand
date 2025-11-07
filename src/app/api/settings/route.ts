import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/Supabase';

// GET /api/settings - Get user settings
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record with personal info
    const { data: userRecord, error: userRecordError } = await supabase
      .from('users')
      .select('first_name, last_name, id_number')
      .eq('id', user.id)
      .single();

    if (userRecordError && userRecordError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is okay if user doesn't exist yet
      console.error('Error fetching user record:', userRecordError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 },
      );
    }

    // Get settings record
    const { data: settingsRecord, error: settingsError } = await supabase
      .from('settings')
      .select('language, timezone, country, dark_mode')
      .eq('user_id', user.id)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 },
      );
    }

    // If settings don't exist, create default settings
    if (!settingsRecord) {
      const { data: newSettings, error: createError } = await supabase
        .from('settings')
        .insert({
          user_id: user.id,
          language: 'he',
          timezone: 'Asia/Jerusalem',
          country: 'il',
          dark_mode: false,
        })
        .select('language, timezone, country, dark_mode')
        .single();

      if (createError) {
        console.error('Error creating default settings:', createError);
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        data: {
          first_name: userRecord?.first_name || '',
          last_name: userRecord?.last_name || '',
          id_number: userRecord?.id_number || '',
          country: newSettings.country,
          language: newSettings.language,
          timezone: newSettings.timezone,
          light_mode: !newSettings.dark_mode, // Convert dark_mode to light_mode for frontend
        },
      });
    }

    // Merge user data with settings
    return NextResponse.json({
      data: {
        first_name: userRecord?.first_name || '',
        last_name: userRecord?.last_name || '',
        id_number: userRecord?.id_number || '',
        country: settingsRecord.country || 'il',
        language: settingsRecord.language || 'he',
        timezone: settingsRecord.timezone || 'Asia/Jerusalem',
        light_mode: !settingsRecord.dark_mode, // Convert dark_mode to light_mode for frontend
      },
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// PUT /api/settings - Update user settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      id_number,
      country,
      language,
      timezone,
      light_mode,
    } = body;

    // Update user record (personal info only - preferences go to settings)
    const userUpdateData: Record<string, any> = {};
    if (first_name !== undefined) {
      userUpdateData.first_name = first_name;
    }
    if (last_name !== undefined) {
      userUpdateData.last_name = last_name;
    }
    if (id_number !== undefined) {
      userUpdateData.id_number = id_number;
    }

    let updatedUser = null;
    if (Object.keys(userUpdateData).length > 0) {
      const { data: userData, error: userUpdateError } = await supabase
        .from('users')
        .update(userUpdateData)
        .eq('id', user.id)
        .select('first_name, last_name, id_number')
        .single();

      if (userUpdateError) {
        console.error('Error updating user:', userUpdateError);
        return NextResponse.json(
          { error: 'Failed to update user data' },
          { status: 500 },
        );
      }
      updatedUser = userData;
    } else {
      // Fetch existing user data if no updates
      const { data: userData } = await supabase
        .from('users')
        .select('first_name, last_name, id_number')
        .eq('id', user.id)
        .single();
      updatedUser = userData;
    }

    // Update or create settings record
    const settingsUpdateData: Record<string, any> = {};
    if (language !== undefined) {
      settingsUpdateData.language = language;
    }
    if (timezone !== undefined) {
      settingsUpdateData.timezone = timezone;
    }
    if (country !== undefined) {
      settingsUpdateData.country = country;
    }
    if (light_mode !== undefined) {
      settingsUpdateData.dark_mode = !light_mode;
    } // Convert light_mode to dark_mode

    let updatedSettings = null;
    if (Object.keys(settingsUpdateData).length > 0) {
      // Try to update existing settings
      const { data: settingsData, error: settingsUpdateError } = await supabase
        .from('settings')
        .update(settingsUpdateData)
        .eq('user_id', user.id)
        .select('language, timezone, country, dark_mode')
        .single();

      if (settingsUpdateError) {
        // If settings don't exist, create them
        if (settingsUpdateError.code === 'PGRST116') {
          const { data: newSettings, error: createError } = await supabase
            .from('settings')
            .insert({
              user_id: user.id,
              language: language || 'he',
              timezone: timezone || 'Asia/Jerusalem',
              country: country || 'il',
              dark_mode: light_mode !== undefined ? !light_mode : false,
            })
            .select('language, timezone, country, dark_mode')
            .single();

          if (createError) {
            console.error('Error creating settings:', createError);
            return NextResponse.json(
              { error: 'Failed to create settings' },
              { status: 500 },
            );
          }
          updatedSettings = newSettings;
        } else {
          console.error('Error updating settings:', settingsUpdateError);
          return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 },
          );
        }
      } else {
        updatedSettings = settingsData;
      }
    } else {
      // Fetch existing settings if no updates
      const { data: settingsData } = await supabase
        .from('settings')
        .select('language, timezone, country, dark_mode')
        .eq('user_id', user.id)
        .single();
      updatedSettings = settingsData;
    }

    // If settings still don't exist, create defaults
    if (!updatedSettings) {
      const { data: newSettings, error: createError } = await supabase
        .from('settings')
        .insert({
          user_id: user.id,
          language: 'he',
          timezone: 'Asia/Jerusalem',
          country: 'il',
          dark_mode: false,
        })
        .select('language, timezone, country, dark_mode')
        .single();

      if (createError) {
        console.error('Error creating default settings:', createError);
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 },
        );
      }
      updatedSettings = newSettings;
    }

    // Return merged data
    return NextResponse.json({
      data: {
        first_name: updatedUser?.first_name || '',
        last_name: updatedUser?.last_name || '',
        id_number: updatedUser?.id_number || '',
        country: updatedSettings.country || 'il',
        language: updatedSettings.language || 'he',
        timezone: updatedSettings.timezone || 'Asia/Jerusalem',
        light_mode: !updatedSettings.dark_mode, // Convert dark_mode to light_mode for frontend
      },
    });
  } catch (error) {
    console.error('Unexpected error in PUT /api/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
