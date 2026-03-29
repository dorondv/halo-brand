import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * User record shape returned by ensureUserRecord.
 * Note: `getlate_api_key` is managed directly via Supabase (not in Drizzle schema)
 * but many API routes depend on it for Getlate integration.
 */
interface UserRecord {
  id: string;
  getlate_api_key: string | null;
}

/**
 * Ensure a row exists in public.users for the authenticated auth user.
 * This handles environments where the auth.users -> public.users trigger is missing.
 */
export async function ensureUserRecord(
  supabase: SupabaseClient,
  authUser: User,
): Promise<UserRecord | null> {
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
    .select('id, getlate_api_key')
    .single();

  if (insertError || !insertedUser) {
    return null;
  }

  return insertedUser;
}
