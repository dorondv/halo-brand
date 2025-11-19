import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export async function createSupabaseServerClient(cookieStore?: CookieStore) {
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set');
  }

  // Use provided cookieStore or create new one (Next.js 16: cookies() can only be called once per request)
  const store = cookieStore || await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              store.set(name, value, options);
            });
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
