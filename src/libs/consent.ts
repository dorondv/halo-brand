export type ConsentState = {
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
  analytics_storage: 'granted' | 'denied';
};

export const CONSENT_STORAGE_KEY = 'branda_consent';
export const CONSENT_VERSION = 1;
export const CONSENT_OPEN_EVENT = 'branda:open-consent';

const DEFAULT_DENIED: ConsentState = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
};

const ALL_GRANTED: ConsentState = {
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  analytics_storage: 'granted',
};

/** @deprecated migrate once; same shape as previous app storage */
export const LEGACY_COOKIE_CONSENT_STORAGE_KEY = 'branda-cookie-consent-v1';

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions -- merging Window for gtag/dataLayer
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getGtag(): (...args: unknown[]) => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }
  return window.gtag;
}

export function updateConsent(state: Partial<ConsentState>) {
  if (typeof window === 'undefined') {
    return;
  }
  const gtag = getGtag();
  gtag('consent', 'update', state);

  const w = window as Window & { fbq?: (...args: string[]) => void };
  if (typeof w.fbq === 'function') {
    const adGranted = state.ad_storage === 'granted';
    w.fbq('consent', adGranted ? 'grant' : 'revoke');
  }

  const stored = getStoredConsent();
  const merged: ConsentState = { ...DEFAULT_DENIED, ...stored, ...state };
  try {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ v: CONSENT_VERSION, ...merged }),
    );
  } catch {
    // ignore
  }
}

export function grantAllConsent() {
  updateConsent(ALL_GRANTED);
}

export function denyAllConsent() {
  updateConsent(DEFAULT_DENIED);
}

export function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { v?: number } & Partial<ConsentState>;
    if (parsed.v !== CONSENT_VERSION) {
      return null;
    }
    const state = Object.fromEntries(
      Object.entries(parsed).filter(([k]) => k !== 'v'),
    ) as Partial<ConsentState>;
    if (
      state.ad_storage
      && state.ad_user_data
      && state.ad_personalization
      && state.analytics_storage
    ) {
      return state as ConsentState;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Applies stored choice to gtag/Meta after load (and persists merged state).
 * Safe to call once on client after consent scripts exist.
 */
export function applyStoredConsent() {
  const stored = getStoredConsent();
  if (stored) {
    updateConsent(stored);
  }
}

export function hasConsentChoice(): boolean {
  return getStoredConsent() !== null;
}

export function openConsentBanner() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
  }
}

/** Optional Google Ads conversion; set NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO e.g. AW-xxx/label */
export function reportGadsConversion(url?: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const sendTo = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO?.trim();
  if (!sendTo) {
    return;
  }
  const gtag = getGtag();
  let navigated = false;
  const navigate = () => {
    if (navigated || !url) {
      return;
    }
    navigated = true;
    window.location.href = url;
  };
  if (url) {
    setTimeout(navigate, 1000);
  }
  gtag('event', 'conversion', {
    send_to: sendTo,
    event_callback: navigate,
  });
}

export function getDefaultDeniedState(): ConsentState {
  return { ...DEFAULT_DENIED };
}

export function getAllGrantedState(): ConsentState {
  return { ...ALL_GRANTED };
}
