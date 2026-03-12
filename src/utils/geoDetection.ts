/**
 * Server-side Geo Detection Utility
 * Uses IP-based geo detection with fallback to client-provided data
 */

type IPGeoResponse = {
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  timezone?: string;
  query?: string; // IP address
};

/**
 * Check if IP address is private/localhost
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/i,
  ];

  // IPv6 localhost
  if (ip === '::1' || ip.startsWith('::ffff:127.')) {
    return true;
  }

  return privateRanges.some(range => range.test(ip));
}

/**
 * Get country code from IP address using ip-api.com
 * Free tier: 45 requests/minute
 */
async function getCountryFromIPAPI(ip: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status === 'success' && data.countryCode) {
      return data.countryCode.toUpperCase();
    }

    return null;
  } catch {
    // Silently fail - geo detection is not critical
    return null;
  }
}

/**
 * Get country code from IP address using ipapi.co (fallback)
 * Free tier: 1,000 requests/day
 */
async function getCountryFromIPAPICo(ip: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const countryCode = await response.text();
    if (countryCode && countryCode.length === 2) {
      return countryCode.trim().toUpperCase();
    }

    return null;
  } catch {
    // Silently fail
    return null;
  }
}

/**
 * Extract IP address from request headers
 * Handles various proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 */
export function extractIPAddress(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  // Handle Headers object
  let getHeader: (name: string) => string | null;
  if (headers instanceof Headers) {
    getHeader = (name: string) => headers.get(name);
  } else {
    getHeader = (name: string) => {
      const value = headers[name.toLowerCase()];
      if (Array.isArray(value)) {
        return value[0] || null;
      }
      return value || null;
    };
  }

  // Check X-Forwarded-For (first IP is the original client)
  const xForwardedFor = getHeader('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    const firstIP = ips[0];
    if (firstIP && !isPrivateIP(firstIP)) {
      return firstIP;
    }
  }

  // Check X-Real-IP
  const xRealIP = getHeader('x-real-ip');
  if (xRealIP && !isPrivateIP(xRealIP)) {
    return xRealIP;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfConnectingIP = getHeader('cf-connecting-ip');
  if (cfConnectingIP && !isPrivateIP(cfConnectingIP)) {
    return cfConnectingIP;
  }

  // Check X-Client-IP
  const xClientIP = getHeader('x-client-ip');
  if (xClientIP && !isPrivateIP(xClientIP)) {
    return xClientIP;
  }

  return null;
}

/**
 * Get country code from IP address
 * Tries ip-api.com first, falls back to ipapi.co
 * Returns null if both fail or IP is private
 */
export async function getCountryFromIP(ip: string | null): Promise<string | null> {
  if (!ip || isPrivateIP(ip)) {
    return null;
  }

  // Try ip-api.com first (better rate limits)
  const country = await getCountryFromIPAPI(ip);
  if (country) {
    return country;
  }

  // Fallback to ipapi.co
  return await getCountryFromIPAPICo(ip);
}

/**
 * Get full geo data from IP address
 * Returns country, city, region, timezone if available
 */
export async function getFullGeoFromIP(ip: string | null): Promise<IPGeoResponse | null> {
  if (!ip || isPrivateIP(ip)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,timezone,query`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status === 'success') {
      return {
        country: data.country,
        countryCode: data.countryCode?.toUpperCase(),
        city: data.city,
        region: data.regionName,
        timezone: data.timezone,
        query: data.query,
      };
    }

    return null;
  } catch {
    return null;
  }
}
