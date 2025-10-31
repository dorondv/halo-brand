import type { LocalePrefixMode } from 'next-intl/routing';

const localePrefix: LocalePrefixMode = 'as-needed';

// FIXME: Update this configuration file based on your project information
export const AppConfig = {
  name: 'Nextjs Starter',
  locales: ['he', 'en'], // Hebrew first as default
  defaultLocale: 'he', // Hebrew is the default locale
  localePrefix,
};
