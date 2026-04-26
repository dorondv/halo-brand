'use client';

import { useEffect } from 'react';
import { useCookieConsent } from '@/contexts/useCookieConsent';
import { initTracking } from '@/utils/tracking';

/**
 * Initialize marketing tracking on page load (first-party analytics), only after analytics consent.
 * Should be added to marketing/landing pages
 */
export function TrackingInit() {
  const { ready, analyticsAllowed } = useCookieConsent();

  useEffect(() => {
    if (!ready || !analyticsAllowed) {
      return;
    }
    initTracking();
  }, [ready, analyticsAllowed]);

  return null;
}
