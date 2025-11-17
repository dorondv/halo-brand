import type { CookieOptions } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function createSupabaseServerClient(cookieStore?: CookieStore) {
  // Use provided cookieStore or create new one (Next.js 16: cookies() can only be called once per request)
  const store = cookieStore || await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            if (typeof store.set === 'function') {
              store.set(name, value, options);
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
            if (typeof store.delete === 'function') {
              store.delete(name);
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
