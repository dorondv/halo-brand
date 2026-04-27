'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/libs/I18nNavigation';

const linkClassName
  = 'text-sm text-gray-500 underline decoration-gray-400/30 underline-offset-2 transition-colors hover:text-gray-600 hover:decoration-gray-500/50 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-gray-500 dark:decoration-gray-600/35 dark:hover:text-gray-400 dark:hover:decoration-gray-500/45 dark:focus-visible:ring-offset-gray-900';

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
        <span aria-hidden className="text-gray-400/80 select-none dark:text-gray-600">|</span>
        <Link href="/terms" className={linkClassName}>
          {t('footer_terms')}
        </Link>
      </div>
    </footer>
  );
}
