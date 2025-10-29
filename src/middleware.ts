import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './libs/I18nRouting';

const handleI18nRouting = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  const res = handleI18nRouting(req);

  return res;
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel` or `monitoring`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)',
};
