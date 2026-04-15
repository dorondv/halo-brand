'use client';

import { Cookie } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/contexts/useCookieConsent';
import { cn } from '@/libs/cn';
import { Link } from '@/libs/I18nNavigation';

export function CookieConsentBanner() {
  const t = useTranslations('CookieConsent');
  const {
    ready,
    preferences,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    closePanel,
    panelOpen,
  } = useCookieConsent();

  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [draftFunctional, setDraftFunctional] = useState(false);

  useEffect(() => {
    if (!preferences) {
      return;
    }
    const id = globalThis.setTimeout(() => {
      setDraftAnalytics(preferences.analytics);
      setDraftFunctional(preferences.functional);
    }, 0);
    return () => globalThis.clearTimeout(id);
  }, [preferences, panelOpen]);

  if (!ready) {
    return null;
  }

  const needsInitialChoice = preferences === null;
  const visible = needsInitialChoice || panelOpen;

  if (!visible) {
    return null;
  }

  const isRTL = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className={cn(
        'fixed inset-x-0 bottom-0 z-[100] border-t border-pink-100 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95',
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className={cn('flex gap-3', isRTL ? 'flex-row-reverse' : '')}>
          <div className="hidden shrink-0 sm:block">
            <Cookie className="h-8 w-8 text-pink-500" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 id="cookie-consent-title" className="text-base font-semibold text-gray-900 dark:text-white">
              {t('title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('description')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t.rich('legal_links', {
                privacy: chunks => (
                  <Link href="/privacy" className="font-medium text-pink-600 underline underline-offset-2 hover:text-pink-700 dark:text-pink-400">
                    {chunks}
                  </Link>
                ),
                terms: chunks => (
                  <Link href="/terms" className="font-medium text-pink-600 underline underline-offset-2 hover:text-pink-700 dark:text-pink-400">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50">
          <label
            htmlFor="cookie-consent-analytics"
            className="flex cursor-pointer items-start gap-3"
            aria-label={`${t('toggle_analytics')}. ${t('toggle_analytics_hint')}`}
          >
            <input
              id="cookie-consent-analytics"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
              checked={draftAnalytics}
              onChange={(e) => {
                const next = e.target.checked;
                setDraftAnalytics(next);
                savePreferences({ analytics: next, functional: draftFunctional });
              }}
            />
            <span aria-hidden="true">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{t('toggle_analytics')}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t('toggle_analytics_hint')}</span>
            </span>
          </label>
          <label
            htmlFor="cookie-consent-functional"
            className="flex cursor-pointer items-start gap-3"
            aria-label={`${t('toggle_functional')}. ${t('toggle_functional_hint')}`}
          >
            <input
              id="cookie-consent-functional"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
              checked={draftFunctional}
              onChange={(e) => {
                const next = e.target.checked;
                setDraftFunctional(next);
                savePreferences({ analytics: draftAnalytics, functional: next });
              }}
            />
            <span aria-hidden="true">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{t('toggle_functional')}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t('toggle_functional_hint')}</span>
            </span>
          </label>
        </div>

        <div className={cn('flex flex-wrap items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
          <Button type="button" className="bg-pink-600 hover:bg-pink-700" onClick={acceptAll}>
            {t('accept_all')}
          </Button>
          <Button type="button" variant="outline" onClick={rejectNonEssential}>
            {t('reject_non_essential')}
          </Button>
          {!needsInitialChoice && panelOpen && (
            <Button type="button" variant="ghost" onClick={closePanel}>
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Footer / header link to reopen cookie preferences */
export function CookieSettingsLink(props: { className?: string }) {
  const t = useTranslations('CookieConsent');
  const { openPreferences } = useCookieConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={cn(
        'text-sm font-medium text-pink-600 underline-offset-2 hover:underline dark:text-pink-400',
        props.className,
      )}
    >
      {t('cookie_settings')}
    </button>
  );
}
