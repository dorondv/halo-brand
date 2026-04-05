import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';

import { AppConfig } from './utils/AppConfig';
import { routing } from './libs/I18nRouting';

// Disable automatic locale detection from browser headers
// Always use the default locale (Hebrew) unless explicitly specified in the URL
// createMiddleware's typing may vary between versions of next-intl; cast to any
// to avoid type mismatch while preserving runtime behavior.
const handleI18nRouting = (createMiddleware as any)(routing, {
  localeDetection: false, // Disable automatic browser locale detection
});

// Supported locales from AppConfig (single source of truth)
const locales = AppConfig.locales;
const localePattern = new RegExp(`^/(${locales.join('|')})(/|$)`);

// Public paths that don't require authentication (without locale prefix)
const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up'];

// Auth-related paths where authenticated users should be redirected to dashboard
const AUTH_PATHS = ['/sign-in', '/sign-up'];

/**
 * Check if a pathname is a public route.
 * Strips the locale prefix dynamically and checks against PUBLIC_PATHS.
 */
function isPublicRoute(pathname: string): boolean {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  // Strip locale prefix to get the bare path
  const barePath = normalized.replace(localePattern, '/') || '/';

  return PUBLIC_PATHS.some(p => barePath === p || barePath.startsWith(`${p}/`));
}

/**
 * Check if the pathname is an auth-related path (sign-in, sign-up)
 */
function isAuthPath(pathname: string): boolean {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const barePath = normalized.replace(localePattern, '/') || '/';

  return AUTH_PATHS.some(p => barePath === p || barePath.startsWith(`${p}/`));
}

// Create Supabase client for proxy (Edge runtime compatible)
function createSupabaseProxyClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Set on both the request (for downstream middleware/routing) and the response
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

/**
 * Copy cookies set by Supabase auth refresh from the temp response to the final response.
 */
function copyCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Skip i18n routing and auth check for API routes - they handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip auth check for static files and Next.js internals
  if (
    pathname.startsWith('/_next')
    || pathname.startsWith('/_vercel')
    || pathname.startsWith('/monitoring')
    || pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if route is public
  const isPublic = isPublicRoute(pathname);

  // Extract locale from pathname for redirects
  // With 'as-needed' prefix mode, Hebrew (default) doesn't have a prefix
  const localeMatch = pathname.match(localePattern);
  const hasLocalePrefix = !!localeMatch;
  const locale = localeMatch ? localeMatch[1] : AppConfig.defaultLocale;

  // Helper to build locale-prefixed URL
  const buildLocalizedUrl = (path: string) => {
    if (locale === AppConfig.defaultLocale && !hasLocalePrefix) {
      // Default locale - no prefix
      return new URL(path, req.url);
    }
    // Non-default locale or default with explicit prefix
    return new URL(`/${locale}${path}`, req.url);
  };

  // If not a public route, check authentication
  if (!isPublic) {
    try {
      // Create a temporary response for Supabase client
      const tempResponse = NextResponse.next();
      const supabase = createSupabaseProxyClient(req, tempResponse);

      // Check if user is authenticated
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      // If not authenticated, redirect to sign-in
      if (error || !user) {
        return NextResponse.redirect(buildLocalizedUrl('/sign-in'));
      }

      // Auth succeeded — continue with i18n routing, preserving refreshed cookies
      const i18nResponse = handleI18nRouting(req);
      copyCookies(tempResponse, i18nResponse);
      return i18nResponse;
    } catch (error) {
      // If auth check fails, redirect to sign-in for safety
      console.error('Auth check failed in middleware:', error);
      return NextResponse.redirect(buildLocalizedUrl('/sign-in'));
    }
  }

  // For public auth routes, check if user is already authenticated
  if (isAuthPath(pathname)) {
    try {
      const tempResponse = NextResponse.next();
      const supabase = createSupabaseProxyClient(req, tempResponse);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If authenticated and trying to access sign-in/sign-up, redirect to dashboard
      if (user) {
        return NextResponse.redirect(buildLocalizedUrl('/dashboard'));
      }
    } catch {
      // If auth check fails on public route, continue (don't block)
      // This allows the page to handle the error gracefully
    }
  }

  // Continue with i18n routing for all public routes
  return handleI18nRouting(req);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel` or `monitoring`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)',
};
