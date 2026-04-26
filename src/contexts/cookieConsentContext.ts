import type { ConsentState } from '@/libs/consent';
import { createContext } from 'react';

export type CookieConsentContextValue = {
  /** True after reading localStorage on the client */
  ready: boolean;
  /** Stored user choice; null means the user has not confirmed preferences yet */
  preferences: ConsentState | null;
  analyticsAllowed: boolean;
  advertisingAllowed: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: ConsentState) => void;
  /** Open the consent UI to change preferences (e.g. from footer link) */
  openPreferences: () => void;
  /** Close panel without saving (only when a choice already exists) */
  closePanel: () => void;
  panelOpen: boolean;
};

export const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);
