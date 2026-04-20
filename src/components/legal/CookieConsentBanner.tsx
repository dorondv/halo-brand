'use client';

import type { ConsentState } from '@/libs/consent';
import { ChevronUp, Cookie, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useCookieConsent } from '@/contexts/useCookieConsent';
import { cn } from '@/libs/cn';
import {
  CONSENT_OPEN_EVENT,
  getDefaultDeniedState,
  getStoredConsent,
} from '@/libs/consent';
import { Link } from '@/libs/I18nNavigation';

export function CookieConsentBanner() {
  const t = useTranslations('CookieConsent');
  const {
    ready,
    preferences,
    acceptAll,
    rejectAll,
    savePreferences,
    closePanel,
    panelOpen,
    openPreferences,
  } = useCookieConsent();

  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState(getDefaultDeniedState);

  useEffect(() => {
    const onOpen = () => openPreferences();
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, [openPreferences]);

  function toggleDetails() {
    const nextOpen = !showDetails;
    setShowDetails(nextOpen);
    if (nextOpen) {
      setPrefs(getStoredConsent() ?? getDefaultDeniedState());
    }
  }

  function handleAcceptAll() {
    acceptAll();
    setShowDetails(false);
  }

  function handleRejectAll() {
    rejectAll();
    setShowDetails(false);
  }

  function handleSavePreferences() {
    savePreferences(prefs);
    setShowDetails(false);
  }

  function togglePref(key: keyof ConsentState) {
    if (key === 'ad_storage' || key === 'ad_user_data' || key === 'ad_personalization') {
      const next = prefs.ad_storage === 'granted' ? 'denied' : 'granted';
      setPrefs(p => ({
        ...p,
        ad_storage: next,
        ad_user_data: next,
        ad_personalization: next,
      }));
      return;
    }
    setPrefs(p => ({
      ...p,
      [key]: p[key] === 'granted' ? 'denied' : 'granted',
    }));
  }

  function handleDismissPanel() {
    closePanel();
    setShowDetails(false);
  }

  if (!ready) {
    return null;
  }

  const needsInitialChoice = preferences === null;
  const showBanner = needsInitialChoice || panelOpen;

  if (!showBanner) {
    return null;
  }

  const isRTL = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] p-4 sm:p-6"
      role="dialog"
      aria-label={t('aria_label')}
    >
      <div className="mx-auto max-w-2xl rounded-xl border border-pink-100 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="px-4 py-3 sm:px-5 sm:py-3.5">
          <div className={cn('flex gap-3', isRTL ? 'flex-row-reverse' : '')}>
            <div className="shrink-0 rounded-full bg-pink-100 p-1.5 dark:bg-pink-900/40">
              <Cookie className="h-4 w-4 text-pink-600 dark:text-pink-400" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {t('title')}
                </span>
                {' '}
                {t('description')}
              </p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
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

          <button
            type="button"
            onClick={toggleDetails}
            className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-pink-600 hover:underline dark:text-pink-400"
          >
            {showDetails
              ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    {t('hidePreferences')}
                  </>
                )
              : (
                  <>
                    <Settings2 className="h-4 w-4" />
                    {t('customize')}
                  </>
                )}
          </button>

          {showDetails && (
            <div className="mt-4 space-y-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{t('analytics')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.analytics_storage === 'granted'}
                  onClick={() => togglePref('analytics_storage')}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2',
                    prefs.analytics_storage === 'granted' ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-600',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition',
                      prefs.analytics_storage === 'granted' ? 'translate-x-5' : 'translate-x-1',
                    )}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{t('advertising')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.ad_storage === 'granted'}
                  onClick={() => togglePref('ad_storage')}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2',
                    prefs.ad_storage === 'granted' ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-600',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition',
                      prefs.ad_storage === 'granted' ? 'translate-x-5' : 'translate-x-1',
                    )}
                  />
                </button>
              </label>
            </div>
          )}

          <div className={cn('mt-3 flex flex-wrap gap-2', isRTL ? 'flex-row-reverse' : '')}>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('acceptAll')}
            </button>
            <button
              type="button"
              onClick={handleRejectAll}
              className="rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {t('rejectAll')}
            </button>
            {showDetails && (
              <button
                type="button"
                onClick={handleSavePreferences}
                className="rounded-lg bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {t('savePreferences')}
              </button>
            )}
            {!needsInitialChoice && panelOpen && (
              <button
                type="button"
                onClick={handleDismissPanel}
                className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {t('cancel')}
              </button>
            )}
          </div>
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
