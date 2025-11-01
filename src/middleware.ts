import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './libs/I18nRouting';

// Disable automatic locale detection from browser headers
// Always use the default locale (Hebrew) unless explicitly specified in the URL
// createMiddleware's typing may vary between versions of next-intl; cast to any
// to avoid type mismatch while preserving runtime behavior.
const handleI18nRouting = (createMiddleware as any)(routing, {
  localeDetection: false, // Disable automatic browser locale detection
});

// Simplified middleware - only handles i18n routing
// Arcjet protection moved to server actions to reduce middleware bundle size
// This keeps the Edge Function under Vercel's 1 MB limit
export async function middleware(req: NextRequest) {
  // Handle i18n routing
  return handleI18nRouting(req);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel` or `monitoring`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)',
};
