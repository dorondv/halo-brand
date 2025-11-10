import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/Supabase';

/**
 * DELETE /api/settings/getlate-api-key
 * Remove the user's integration API key (disconnect integration)
 */
export async function DELETE(_request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Remove API key from database
    const { error: updateError } = await supabase
      .from('users')
      .update({ getlate_api_key: null })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error removing API key:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove API key' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing Getlate API key:', error);
    return NextResponse.json(
      { error: 'Failed to remove API key' },
      { status: 500 },
    );
  }
}
