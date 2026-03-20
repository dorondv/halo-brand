import type { User } from '@supabase/supabase-js';

/**
 * Ensure a row exists in public.users for the authenticated auth user.
 * This handles environments where the auth.users -> public.users trigger is missing.
 */
export async function ensureUserRecord(
  supabase: any,
  authUser: User,
): Promise<{ id: string; getlate_api_key: string | null } | null> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, getlate_api_key')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingUser) {
    return existingUser;
  }

  const fallbackName
    = authUser.user_metadata?.full_name
      || authUser.user_metadata?.name
      || authUser.email?.split('@')[0]
      || 'User';

  const { data: insertedUser, error: insertError } = await supabase
    .from('users')
    .insert([
      {
        id: authUser.id,
        email: authUser.email || '',
        name: fallbackName,
        plan: 'free',
        is_active: true,
      },
    ])
    .select('id')
    .single();

  if (insertError || !insertedUser) {
    return null;
  }

  const { data: createdUser } = await supabase
    .from('users')
    .select('id, getlate_api_key')
    .eq('id', authUser.id)
    .maybeSingle();

  return createdUser || { id: insertedUser.id, getlate_api_key: null };
}
