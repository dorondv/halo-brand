'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/libs/I18nNavigation';

const linkClassName
  = 'text-sm text-pink-600 underline decoration-pink-600/50 underline-offset-2 transition-colors hover:decoration-pink-600 hover:text-pink-700 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-pink-400 dark:decoration-pink-400/50 dark:hover:text-pink-300 dark:hover:decoration-pink-300 dark:focus-visible:ring-offset-gray-900';

/**
 * Bottom bar: centered privacy | terms, styled as links.
 */
export function LegalLinksFooter() {
  const t = useTranslations('Marketing');

  return (
    <footer
      className="shrink-0 border-t border-gray-200 bg-white/80 dark:border-gray-800/80 dark:bg-gray-900/80"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 gap-x-3 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/privacy" className={linkClassName}>
          {t('footer_privacy')}
        </Link>
        <span aria-hidden className="text-gray-400 select-none dark:text-gray-500">|</span>
        <Link href="/terms" className={linkClassName}>
          {t('footer_terms')}
        </Link>
      </div>
    </footer>
  );
}
