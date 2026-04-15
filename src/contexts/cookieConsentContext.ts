import type { CookieConsentPreferences } from '@/libs/cookieConsent';
import { createContext } from 'react';

export type CookieConsentContextValue = {
  /** True after reading localStorage on the client */
  ready: boolean;
  /** Stored user choice; null means the user has not confirmed preferences yet */
  preferences: CookieConsentPreferences | null;
  analyticsAllowed: boolean;
  functionalAllowed: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (prefs: { analytics: boolean; functional: boolean }) => void;
  /** Open the consent UI to change preferences (e.g. from footer link) */
  openPreferences: () => void;
  /** Close panel without saving (only when a choice already exists) */
  closePanel: () => void;
  panelOpen: boolean;
};

export const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);
