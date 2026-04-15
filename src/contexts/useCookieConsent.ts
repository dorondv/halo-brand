import type { CookieConsentContextValue } from '@/contexts/cookieConsentContext';
import { use } from 'react';
import { CookieConsentContext } from '@/contexts/cookieConsentContext';

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = use(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return ctx;
}
