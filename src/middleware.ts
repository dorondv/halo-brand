import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import aj, { ajSignup } from './libs/Arcjet';
import { routing } from './libs/I18nRouting';

// Disable automatic locale detection from browser headers
// Always use the default locale (Hebrew) unless explicitly specified in the URL
// createMiddleware's typing may vary between versions of next-intl; cast to any
// to avoid type mismatch while preserving runtime behavior.
const handleI18nRouting = (createMiddleware as any)(routing, {
  localeDetection: false, // Disable automatic browser locale detection
});

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Check if this is a signup route (with or without locale prefix)
  const isSignupRoute = pathname.includes('/sign-up') || pathname.includes('/signup');

  // Apply Arcjet protection first (if configured)
  // Use stricter rules for signup routes
  const arcjetInstance = isSignupRoute && ajSignup ? ajSignup : aj;

  if (arcjetInstance) {
    const decision = await arcjetInstance.protect(req);

    // If request is denied, return the response immediately
    if (decision.isDenied()) {
      const status = decision.reason.isRateLimit() ? 429 : 403;
      const message = isSignupRoute && status === 429
        ? 'Too many signup attempts. Please try again later.'
        : 'Access denied';
      return new Response(message, { status });
    }
  }

  // Continue with i18n routing
  const res = handleI18nRouting(req);

  return res;
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel` or `monitoring`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)',
};
