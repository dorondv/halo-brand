import type { LocalePrefixMode } from 'next-intl/routing';

const localePrefix: LocalePrefixMode = 'as-needed';

// FIXME: Update this configuration file based on your project information
export const AppConfig = {
  /** Single source for product name in UI metadata, exports (PDF/CSV), emails, and alt text. */
  name: 'Branda',
  locales: ['he', 'en', 'es', 'fr', 'de', 'pt'],
  /** URL default (Hebrew has no prefix with localePrefix: 'as-needed'). Visitor default is geo-based in proxy. */
  defaultLocale: 'he',
  localePrefix,
};
