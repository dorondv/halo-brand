export const COOKIE_CONSENT_STORAGE_KEY = 'branda-cookie-consent-v1';

export type CookieConsentPreferences = {
  version: 1;
  analytics: boolean;
  functional: boolean;
  updatedAt: string;
};

export function isCookieConsentPreferences(value: unknown): value is CookieConsentPreferences {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    v.version === 1
    && typeof v.analytics === 'boolean'
    && typeof v.functional === 'boolean'
    && typeof v.updatedAt === 'string'
  );
}

export function parseStoredCookieConsent(raw: string | null): CookieConsentPreferences | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCookieConsentPreferences(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function buildCookieConsent(partial: {
  analytics: boolean;
  functional: boolean;
}): CookieConsentPreferences {
  return {
    version: 1,
    analytics: partial.analytics,
    functional: partial.functional,
    updatedAt: new Date().toISOString(),
  };
}
