import type { CookieOptions } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            if (typeof cookieStore.set === 'function') {
              cookieStore.set(name, value, options);
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Supabase cookie set skipped:', (error as Error).message);
            }
          }
        },
        remove(name: string, _options: CookieOptions) {
          try {
            if (typeof cookieStore.delete === 'function') {
              cookieStore.delete(name);
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Supabase cookie delete skipped:', (error as Error).message);
            }
          }
        },
      },
    },
  );
}
