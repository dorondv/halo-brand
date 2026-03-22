import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** Auth error codes that indicate stale/invalid session - clear cookies and treat as signed out */
const STALE_SESSION_CODES = [
  'refresh_token_not_found',
  'refresh_token_revoked',
  'invalid_grant',
  'invalid_refresh_token',
];

function isStaleSessionError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code && STALE_SESSION_CODES.includes(err.code)) {
    return true;
  }

  const message = (err?.message || '').toLowerCase();
  return (
    message.includes('refresh token not found')
    || message.includes('invalid refresh token')
    || message.includes('refresh_token_not_found')
    || message.includes('refresh token revoked')
  );
}

/** Serializable stub for auth errors - avoids passing raw Error (can break JSON.parse) */
const SESSION_EXPIRED_ERROR = Object.freeze({ message: 'Session expired', code: 'session_expired' });

/**
 * Wraps auth.getUser to handle stale refresh tokens: signs out locally, returns null.
 * Returns a plain serializable error object (never raw Error) to avoid JSON parse issues.
 */
function wrapGetUserSafe<T extends { auth: { getUser: () => Promise<unknown>; signOut: (o: { scope: 'local' }) => Promise<unknown> } }>(client: T): T {
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async () => {
    try {
      const result = (await originalGetUser()) as { data: { user: unknown }; error: unknown };
      if (result.error && isStaleSessionError(result.error)) {
        await client.auth.signOut({ scope: 'local' });
        return { data: { user: null }, error: SESSION_EXPIRED_ERROR };
      }
      return result;
    } catch (err) {
      if (isStaleSessionError(err)) {
        try {
          await client.auth.signOut({ scope: 'local' });
        } catch {
          /* ignore */
        }
      }
      return { data: { user: null }, error: SESSION_EXPIRED_ERROR };
    }
  };
  return client;
}

/**
 * Gets the current user. On stale refresh token errors, signs out and returns null.
 * Use for pages where auth is optional (sign-in, sign-up, marketing).
 */
export async function getUserSafe(cookieStore?: CookieStore) {
  const supabase = await createSupabaseServerClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user: error ? null : user };
}

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

  const client = createServerClient(
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
        // Server-side clients should not run background refresh/persistence logic.
        // They should only read/write session via request/response cookies.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
  return wrapGetUserSafe(client);
}
