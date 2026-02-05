import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';

import { routing } from './libs/I18nRouting';

// Disable automatic locale detection from browser headers
// Always use the default locale (Hebrew) unless explicitly specified in the URL
// createMiddleware's typing may vary between versions of next-intl; cast to any
// to avoid type mismatch while preserving runtime behavior.
const handleI18nRouting = (createMiddleware as any)(routing, {
  localeDetection: false, // Disable automatic browser locale detection
});

// Check if a pathname is a public route
function isPublicRoute(pathname: string): boolean {
  // Normalize pathname (remove trailing slash except for root)
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

  // Root route (marketing page) - can be / or /en/ or /he/ or /es/ or /fr/ or /de/
  if (normalized === '/' || normalized === '/en' || normalized === '/he' || normalized === '/es' || normalized === '/fr' || normalized === '/de') {
    return true;
  }

  // Sign-in routes - /sign-in, /en/sign-in, /he/sign-in, /es/sign-in, /fr/sign-in, /de/sign-in
  if (
    normalized === '/sign-in'
    || normalized === '/en/sign-in'
    || normalized === '/he/sign-in'
    || normalized === '/es/sign-in'
    || normalized === '/fr/sign-in'
    || normalized === '/de/sign-in'
    || normalized.startsWith('/sign-in/')
    || normalized.startsWith('/en/sign-in/')
    || normalized.startsWith('/he/sign-in/')
    || normalized.startsWith('/es/sign-in/')
    || normalized.startsWith('/fr/sign-in/')
    || normalized.startsWith('/de/sign-in/')
  ) {
    return true;
  }

  // Sign-up routes - /sign-up, /en/sign-up, /he/sign-up, /es/sign-up, /fr/sign-up, /de/sign-up
  if (
    normalized === '/sign-up'
    || normalized === '/en/sign-up'
    || normalized === '/he/sign-up'
    || normalized === '/es/sign-up'
    || normalized === '/fr/sign-up'
    || normalized === '/de/sign-up'
    || normalized.startsWith('/sign-up/')
    || normalized.startsWith('/en/sign-up/')
    || normalized.startsWith('/he/sign-up/')
    || normalized.startsWith('/es/sign-up/')
    || normalized.startsWith('/fr/sign-up/')
    || normalized.startsWith('/de/sign-up/')
  ) {
    return true;
  }

  return false;
}

// Create Supabase client for middleware (Edge runtime compatible)
function createSupabaseMiddlewareClient(request: NextRequest, response: NextResponse) {
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
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function middleware(req: NextRequest) {
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
  const localeMatch = pathname.match(/^\/(en|he|es|fr|de)(\/|$)/);
  const hasLocalePrefix = !!localeMatch;
  const locale = localeMatch ? localeMatch[1] : 'he'; // Default to Hebrew

  // Helper to build locale-prefixed URL
  const buildLocalizedUrl = (path: string) => {
    if (locale === 'he' && !hasLocalePrefix) {
      // Hebrew default locale - no prefix
      return new URL(path, req.url);
    }
    // English or Hebrew with prefix
    return new URL(`/${locale}${path}`, req.url);
  };

  // If not a public route, check authentication
  if (!isPublic) {
    try {
      // Create a temporary response for Supabase client
      const tempResponse = NextResponse.next();
      const supabase = createSupabaseMiddlewareClient(req, tempResponse);

      // Check if user is authenticated
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      // If not authenticated, redirect to sign-in
      if (error || !user) {
        return NextResponse.redirect(buildLocalizedUrl('/sign-in'));
      }
    } catch (error) {
      // If auth check fails, redirect to sign-in for safety
      console.error('Auth check failed in middleware:', error);
      return NextResponse.redirect(buildLocalizedUrl('/sign-in'));
    }
  } else {
    // For public routes, check if user is already authenticated
    // If authenticated and on sign-in/sign-up, redirect to dashboard
    if (pathname.includes('/sign-in') || pathname.includes('/sign-up')) {
      try {
        const tempResponse = NextResponse.next();
        const supabase = createSupabaseMiddlewareClient(req, tempResponse);

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
  }

  // Continue with i18n routing for all routes
  return handleI18nRouting(req);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel` or `monitoring`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)',
};
