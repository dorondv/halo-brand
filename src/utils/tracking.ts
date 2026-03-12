'use client';

import { getCountryFromLanguage, getCountryFromTimezone } from './timezoneToCountry';

/**
 * UTM Parameters and Click IDs
 */
export type UTMParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string; // Google click ID
  fbclid?: string; // Facebook click ID
  msclkid?: string; // Microsoft click ID
  ttclid?: string; // TikTok click ID
};

/**
 * Geo Data
 */
export type GeoData = {
  timezone?: string;
  language?: string;
  country?: string;
};

/**
 * Business Data
 */
export type BusinessData = {
  purchaseAmount?: number;
  currency?: string;
  revenueTotal?: number;
};

/**
 * First Touch Data (stored in localStorage)
 */
type FirstTouchData = {
  utm: UTMParams;
  geo: GeoData;
  referrer?: string;
  landingUrl?: string;
  timestamp: number;
};

const FIRST_TOUCH_KEY = 'marketing_first_touch';
const API_URL = process.env.NEXT_PUBLIC_APP_URL || '';

/**
 * Extract UTM parameters and click IDs from URL
 */
export function extractUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  const utm: UTMParams = {};

  // UTM parameters
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmTerm = params.get('utm_term');
  const utmContent = params.get('utm_content');

  if (utmSource) {
    utm.utm_source = utmSource;
  }
  if (utmMedium) {
    utm.utm_medium = utmMedium;
  }
  if (utmCampaign) {
    utm.utm_campaign = utmCampaign;
  }
  if (utmTerm) {
    utm.utm_term = utmTerm;
  }
  if (utmContent) {
    utm.utm_content = utmContent;
  }

  // Click IDs
  const gclid = params.get('gclid');
  const fbclid = params.get('fbclid');
  const msclkid = params.get('msclkid');
  const ttclid = params.get('ttclid');

  if (gclid) {
    utm.gclid = gclid;
  }
  if (fbclid) {
    utm.fbclid = fbclid;
  }
  if (msclkid) {
    utm.msclkid = msclkid;
  }
  if (ttclid) {
    utm.ttclid = ttclid;
  }

  return utm;
}

/**
 * Get geo data from browser (timezone, language, country)
 */
export function getGeoData(): GeoData {
  if (typeof window === 'undefined') {
    return {};
  }

  const geo: GeoData = {};

  // Get timezone
  try {
    geo.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Fallback if timezone detection fails
  }

  // Get language
  geo.language = navigator.language || navigator.languages?.[0];

  // Try to get country from timezone
  if (geo.timezone) {
    const countryFromTz = getCountryFromTimezone(geo.timezone);
    if (countryFromTz) {
      geo.country = countryFromTz;
    }
  }

  // Try to get country from language code
  if (!geo.country && geo.language) {
    const countryFromLang = getCountryFromLanguage(geo.language);
    if (countryFromLang) {
      geo.country = countryFromLang;
    }
  }

  return geo;
}

/**
 * Store first touch data in localStorage
 */
export function storeFirstTouch(utm: UTMParams, geo: GeoData, referrer?: string, landingUrl?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Check if we already have first touch data
  const existing = getFirstTouch();
  if (existing) {
    // Only update if we have UTM params and didn't have them before
    const hasUTM = Object.keys(utm).length > 0;
    const hadUTM = existing.utm && Object.keys(existing.utm).length > 0;
    if (!hasUTM || hadUTM) {
      return; // Keep existing first touch
    }
  }

  const firstTouch: FirstTouchData = {
    utm,
    geo,
    referrer: referrer || document.referrer || undefined,
    landingUrl: landingUrl || window.location.href,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
  } catch {
    // localStorage might be disabled or full
    console.warn('Failed to store first touch data');
  }
}

/**
 * Get first touch data from localStorage
 */
export function getFirstTouch(): FirstTouchData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as FirstTouchData;
    return data;
  } catch {
    return null;
  }
}

/**
 * Track marketing event
 * @param eventType Event type (pageview, signup_start, signup_complete, lead_submit, purchase_complete)
 * @param business Optional business data (purchase amount, currency, revenue)
 * @param userId Optional user ID (for authenticated events)
 */
export async function trackEvent(
  eventType: 'pageview' | 'signup_start' | 'signup_complete' | 'lead_submit' | 'purchase_complete',
  business?: BusinessData,
  userId?: string,
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // Get current UTM params
  const currentUTM = extractUTMParams();
  const currentGeo = getGeoData();

  // Get first touch data
  const firstTouch = getFirstTouch();

  // Use current UTM if available, otherwise use first touch UTM
  const utm = Object.keys(currentUTM).length > 0 ? currentUTM : firstTouch?.utm || {};

  // Use current geo if available, otherwise use first touch geo
  const geo = currentGeo.country ? currentGeo : firstTouch?.geo || currentGeo;

  // Store first touch if we have UTM params and haven't stored yet
  if (Object.keys(utm).length > 0 && !firstTouch) {
    storeFirstTouch(utm, geo);
  }

  // Prepare event payload
  const payload = {
    eventType,
    userId: userId || undefined,
    url: window.location.href,
    referrer: document.referrer || firstTouch?.referrer || undefined,
    utm: {
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_term: utm.utm_term,
      utm_content: utm.utm_content,
      gclid: utm.gclid,
      fbclid: utm.fbclid,
      msclkid: utm.msclkid,
      ttclid: utm.ttclid,
    },
    geo: {
      timezone: geo.timezone,
      language: geo.language,
      country: geo.country,
    },
    business: business || undefined,
  };

  // Send event to backend (fire-and-forget)
  try {
    await fetch(`${API_URL}/api/marketing/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true, // Keep request alive even if page unloads
    });
  } catch (error) {
    // Silently fail - tracking should not break the app
    console.warn('Failed to track event:', error);
  }
}

/**
 * Initialize tracking on page load
 * Automatically tracks pageview events
 */
export function initTracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Track initial pageview
  trackEvent('pageview');

  // Track pageviews on navigation (for SPA)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      trackEvent('pageview');
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also listen to popstate for browser back/forward
  window.addEventListener('popstate', () => {
    trackEvent('pageview');
  });
}
