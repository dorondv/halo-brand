import { describe, expect, it } from 'vitest';

import {
  getCountryFromRequestHeaders,
  getDefaultLocaleFromCountry,
} from './geoDetection';

describe('geoDetection locale defaults', () => {
  it('reads country from Vercel geo header', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'IL' });

    expect(getCountryFromRequestHeaders(headers)).toBe('IL');
  });

  it('reads country from Cloudflare geo header', () => {
    const headers = new Headers({ 'cf-ipcountry': 'us' });

    expect(getCountryFromRequestHeaders(headers)).toBe('US');
  });

  it('maps Israel to Hebrew and other countries to English', () => {
    expect(getDefaultLocaleFromCountry('IL')).toBe('he');
    expect(getDefaultLocaleFromCountry('US')).toBe('en');
    expect(getDefaultLocaleFromCountry('FR')).toBe('en');
  });

  it('falls back to Hebrew when country is unknown (local dev)', () => {
    expect(getDefaultLocaleFromCountry(null)).toBe('he');
  });
});
