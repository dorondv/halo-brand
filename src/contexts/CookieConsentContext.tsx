'use client';

import type React from 'react';
import type { ConsentState } from '@/libs/consent';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CookieConsentContext } from '@/contexts/cookieConsentContext';
import {
  applyStoredConsent,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  denyAllConsent,
  getStoredConsent,
  grantAllConsent,
  LEGACY_COOKIE_CONSENT_STORAGE_KEY,
  updateConsent,
} from '@/libs/consent';

function migrateLegacyConsent(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (localStorage.getItem(CONSENT_STORAGE_KEY)) {
      return;
    }
    const raw = localStorage.getItem(LEGACY_COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as { version?: number; analytics?: boolean; functional?: boolean };
    if (parsed.version !== 1 || typeof parsed.analytics !== 'boolean') {
      return;
    }
    const next: ConsentState = {
      analytics_storage: parsed.analytics ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    };
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ v: CONSENT_VERSION, ...next }),
    );
    localStorage.removeItem(LEGACY_COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function CookieConsentProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<ConsentState | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    migrateLegacyConsent();
    applyStoredConsent();
    const stored = getStoredConsent();
    const id = globalThis.setTimeout(() => {
      setPreferences(stored);
      setReady(true);
    }, 0);
    return () => globalThis.clearTimeout(id);
  }, []);

  const persistFromLib = useCallback((next: ConsentState) => {
    setPreferences(next);
    setPanelOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    grantAllConsent();
    persistFromLib(getStoredConsent()!);
  }, [persistFromLib]);

  const rejectAll = useCallback(() => {
    denyAllConsent();
    persistFromLib(getStoredConsent()!);
  }, [persistFromLib]);

  const savePreferences = useCallback(
    (prefs: ConsentState) => {
      updateConsent(prefs);
      persistFromLib(getStoredConsent()!);
    },
    [persistFromLib],
  );

  const openPreferences = useCallback(() => {
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const analyticsAllowed = Boolean(ready && preferences?.analytics_storage === 'granted');
  const advertisingAllowed = Boolean(ready && preferences?.ad_storage === 'granted');

  const value = useMemo(
    () => ({
      ready,
      preferences,
      analyticsAllowed,
      advertisingAllowed,
      acceptAll,
      rejectAll,
      savePreferences,
      openPreferences,
      closePanel,
      panelOpen,
    }),
    [
      ready,
      preferences,
      analyticsAllowed,
      advertisingAllowed,
      acceptAll,
      rejectAll,
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
