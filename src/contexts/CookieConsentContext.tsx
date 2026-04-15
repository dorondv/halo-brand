'use client';

import type React from 'react';
import type { CookieConsentPreferences } from '@/libs/cookieConsent';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CookieConsentContext } from '@/contexts/cookieConsentContext';
import {
  buildCookieConsent,
  COOKIE_CONSENT_STORAGE_KEY,
  parseStoredCookieConsent,
} from '@/libs/cookieConsent';

function shouldReloadAfterWithdraw(
  previous: CookieConsentPreferences | null,
  next: CookieConsentPreferences,
): boolean {
  if (!previous) {
    return false;
  }
  const withdrewAnalytics = previous.analytics && !next.analytics;
  const withdrewFunctional = previous.functional && !next.functional;
  return withdrewAnalytics || withdrewFunctional;
}

export function CookieConsentProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<CookieConsentPreferences | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const stored = parseStoredCookieConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
    // Defer with a macrotask so this runs after the App Router finishes initializing.
    // queueMicrotask caused "Router action dispatched before initialization" when consent
    // flipped ready and next-intl Link mounted in the same hydration turn.
    const id = globalThis.setTimeout(() => {
      setPreferences(stored);
      setReady(true);
    }, 0);
    return () => globalThis.clearTimeout(id);
  }, []);

  const persist = useCallback(
    (next: CookieConsentPreferences, previous: CookieConsentPreferences | null) => {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next));
      setPreferences(next);
      setPanelOpen(false);
      if (typeof window !== 'undefined' && shouldReloadAfterWithdraw(previous, next)) {
        window.location.reload();
      }
    },
    [],
  );

  const acceptAll = useCallback(() => {
    const next = buildCookieConsent({ analytics: true, functional: true });
    persist(next, preferences);
  }, [persist, preferences]);

  const rejectNonEssential = useCallback(() => {
    const next = buildCookieConsent({ analytics: false, functional: false });
    persist(next, preferences);
  }, [persist, preferences]);

  const savePreferences = useCallback(
    (prefs: { analytics: boolean; functional: boolean }) => {
      const next = buildCookieConsent(prefs);
      persist(next, preferences);
    },
    [persist, preferences],
  );

  const openPreferences = useCallback(() => {
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const analyticsAllowed = Boolean(ready && preferences?.analytics);
  const functionalAllowed = Boolean(ready && preferences?.functional);

  const value = useMemo(
    () => ({
      ready,
      preferences,
      analyticsAllowed,
      functionalAllowed,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openPreferences,
      closePanel,
      panelOpen,
    }),
    [
      ready,
      preferences,
      analyticsAllowed,
      functionalAllowed,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openPreferences,
      closePanel,
      panelOpen,
    ],
  );

  return (
    <CookieConsentContext value={value}>
      {props.children}
    </CookieConsentContext>
  );
}
