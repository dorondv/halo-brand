import { routing } from '@/libs/I18nRouting';

/**
 * Gets the base URL for the app. On Vercel, never falls back to localhost.
 * Per Vercel docs: VERCEL_URL is automatically set for all deployments.
 */
export const getBaseUrl = () => {
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
 * Prefers request headers (reflects actual URL user is on); falls back to env vars.
 *
 * Supabase dashboard must whitelist: production, https://*.vercel.app/api/auth/callback, localhost.
 *
 * @param headers - Optional headers from headers() - use in server actions for reliable detection
 */
export async function getAuthCallbackUrl(headers?: Headers): Promise<string> {
  if (headers) {
    const scheme = headers.get('x-forwarded-proto') === 'http' ? 'http' : 'https';
    const host = headers.get('x-forwarded-host') || headers.get('host') || '';
    if (host) {
      return `${scheme}://${host}/api/auth/callback`;
    }
  }
  return `${getBaseUrl()}/api/auth/callback`;
}
