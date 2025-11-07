import { routing } from '@/libs/I18nRouting';

export const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (
    process.env.VERCEL_ENV === 'production'
    && process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
};

export const getI18nPath = (url: string, locale: string) => {
  if (locale === routing.defaultLocale) {
    return url;
  }

  return `/${locale}${url}`;
};

export const isServer = () => {
  return typeof window === 'undefined';
};

/**
 * Gets the auth callback URL for Supabase OAuth.
 *
 * For Supabase auth callbacks, you need to whitelist redirect URLs in your Supabase dashboard:
 * - Production: https://yourdomain.com/api/auth/callback (or use NEXT_PUBLIC_APP_URL)
 * - Previews: https://*.vercel.app/api/auth/callback (wildcard pattern)
 * - Local: http://localhost:3000/api/auth/callback
 *
 * @param headers - Optional headers object from Next.js headers() - use this in server actions for reliable URL detection
 * @returns The full callback URL including the /api/auth/callback path
 */
export async function getAuthCallbackUrl(headers?: Headers) {
  // If headers are provided (server actions), use them for reliable URL detection
  if (headers) {
    const protocol = headers.get('x-forwarded-proto') || 'https';
    const host = headers.get('host') || '';
    if (host) {
      return `${protocol}://${host}/api/auth/callback`;
    }
  }

  // Fallback to environment variables
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/auth/callback`;
}
