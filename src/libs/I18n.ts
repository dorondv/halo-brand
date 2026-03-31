import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './I18nRouting';

async function loadMessages(locale: string) {
  // In dev, read JSON from disk so edits to locale files show up without a stale
  // Turbopack/Webpack cache (see next.config experimental.turbopackFileSystemCacheForDev).
  if (process.env.NODE_ENV === 'development') {
    try {
      const filePath = join(process.cwd(), 'src', 'locales', `${locale}.json`);
      return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    } catch {
      /* e.g. Edge without fs — fall through */
    }
  }
  return (await import(`../locales/${locale}.json`)).default;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
