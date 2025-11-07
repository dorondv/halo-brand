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
            // Silently handle cookie errors - they're expected in some contexts
            // Only log in development for debugging
            if (process.env.NODE_ENV === 'development') {
              const errorMessage = error instanceof Error ? error.message : String(error);
              // Only warn about cookie errors if they're not the expected "can only be modified" error
              if (!errorMessage.includes('can only be modified')) {
                console.warn('Supabase cookie set skipped:', errorMessage);
              }
            }
          }
        },
        remove(name: string, _options: CookieOptions) {
          try {
            if (typeof cookieStore.delete === 'function') {
              cookieStore.delete(name);
            }
          } catch (error) {
            // Silently handle cookie errors - they're expected in some contexts
            // Only log in development for debugging
            if (process.env.NODE_ENV === 'development') {
              const errorMessage = error instanceof Error ? error.message : String(error);
              // Only warn about cookie errors if they're not the expected "can only be modified" error
              if (!errorMessage.includes('can only be modified')) {
                console.warn('Supabase cookie delete skipped:', errorMessage);
              }
            }
          }
        },
      },
      auth: {
        // Disable automatic token refresh to prevent refresh token errors
        // Token refresh should be handled manually or via Supabase's built-in mechanisms
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // We handle OAuth callbacks manually
      },
    },
  );
}
