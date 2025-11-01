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

// Lazy load Arcjet only when needed to reduce middleware bundle size
// Use direct process.env check to avoid bundling heavy Env validation library
async function getArcjetInstance(isSignup: boolean) {
  // Only load Arcjet if API key is configured
  // Using direct env check to reduce bundle size (Env import includes zod + @t3-oss/env-nextjs)
  const arcjetKey = process.env.ARCJET_KEY;
  if (!arcjetKey) {
    return null;
  }

  // Dynamic import to avoid bundling Arcjet in middleware unless actually used
  const arcjetModule = await import('@arcjet/next');
  const { default: arcjet, detectBot, fixedWindow, shield, slidingWindow } = arcjetModule;

  if (isSignup) {
    // Stricter Arcjet instance for signup routes
    return arcjet({
      key: arcjetKey,
      characteristics: ['ip.src', 'http.request.uri.path'],
      rules: [
        shield({
          mode: 'LIVE',
        }),
        detectBot({
          mode: 'LIVE',
          allow: [
            'CATEGORY:SEARCH_ENGINE',
            'CATEGORY:MONITOR',
          ],
        }),
        fixedWindow({
          mode: 'LIVE',
          window: '15m',
          max: 5,
        }),
        slidingWindow({
          mode: 'LIVE',
          interval: '1h',
          max: 10,
        }),
      ],
    });
  }

  // Standard Arcjet instance for all other routes
  return arcjet({
    key: arcjetKey,
    characteristics: ['ip.src', 'http.request.uri.path'],
    rules: [
      shield({
        mode: 'LIVE',
      }),
      detectBot({
        mode: 'LIVE',
        allow: [
          'CATEGORY:SEARCH_ENGINE',
          'CATEGORY:MONITOR',
        ],
      }),
      fixedWindow({
        mode: 'LIVE',
        window: '1m',
        max: 30,
      }),
      slidingWindow({
        mode: 'LIVE',
        interval: '1h',
        max: 1000,
      }),
    ],
  });
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Check if this is a signup route (with or without locale prefix)
  const isSignupRoute = pathname.includes('/sign-up') || pathname.includes('/signup');

  // Apply Arcjet protection first (if configured)
  // Use dynamic import to reduce bundle size
  const arcjetInstance = await getArcjetInstance(isSignupRoute);

  if (arcjetInstance) {
    const decision = await arcjetInstance.protect(req);

    // If request is denied, return the response immediately
    if (decision.isDenied()) {
      const isRateLimit = decision.reason.isRateLimit();
      const isBot = decision.reason.isBot();
      const status = isRateLimit ? 429 : 403;

      let message = 'Access denied';
      if (isSignupRoute && isRateLimit) {
        message = 'Too many signup attempts. Please try again later.';
      } else if (isBot) {
        message = 'Bot detected. Access denied.';
      }

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
