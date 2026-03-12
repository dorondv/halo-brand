/**
 * PayPal Service
 * Handles all PayPal API interactions using direct REST API calls
 */

import { Env } from './Env';

// PayPal API endpoints
const PAYPAL_BASE_URL = Env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

let accessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get PayPal access token
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  const clientId = Env.PAYPAL_CLIENT_ID;
  const clientSecret = Env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
  }

  try {
    // eslint-disable-next-line node/prefer-global/buffer
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get PayPal access token: ${error}`);
    }

    const data = await response.json();
    const expiresIn = data.expires_in || 32400; // Default 9 hours
    accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000, // Refresh 5 minutes before expiry
    };

    return data.access_token;
  } catch (error: any) {
    console.error('Error getting PayPal access token:', error);
    throw new Error(`Failed to get PayPal access token: ${error.message}`);
  }
}

/**
 * Make authenticated PayPal API request
 */
async function paypalRequest(endpoint: string, options: RequestInit & { params?: Record<string, any> } = {}): Promise<any> {
  const token = await getAccessToken();
  let url = endpoint.startsWith('http') ? endpoint : `${PAYPAL_BASE_URL}${endpoint}`;

  // Handle query parameters
  if (options.params && Object.keys(options.params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}${searchParams.toString()}`;
  }

  // Remove params from options to avoid passing it to fetch
  const { params, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal API error: ${error}`);
  }

  // Handle empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  return await response.json();
}

/**
 * Get PayPal Client ID (for frontend SDK)
 */
export function getPayPalClientId(): string {
  const clientId = Env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    throw new Error('PayPal Client ID not configured');
  }
  return clientId;
}

/**
 * Get PayPal Plan ID by plan type and billing cycle
 */
export function getPayPalPlanId(
  planType: 'basic' | 'pro' | 'business',
  billingCycle: 'monthly' | 'annual' = 'monthly',
): string {
  const planIdMap: Record<string, string | undefined> = {
    'basic-monthly': Env.PAYPAL_BASIC_PLAN_MONTHLY,
    'basic-annual': Env.PAYPAL_BASIC_PLAN_ANNUAL,
    'pro-monthly': Env.PAYPAL_PRO_PLAN_MONTHLY,
    'pro-annual': Env.PAYPAL_PRO_PLAN_ANNUAL,
    'business-monthly': Env.PAYPAL_GOLD_PLAN_MONTHLY,
    'business-annual': Env.PAYPAL_GOLD_PLAN_ANNUAL,
  };

  const key = `${planType}-${billingCycle}`;
  const planId = planIdMap[key];

  if (!planId) {
    throw new Error(`PayPal Plan ID not configured for ${planType} (${billingCycle}). Please set PAYPAL_${planType.toUpperCase()}_PLAN_${billingCycle.toUpperCase()} in your .env file.`);
  }

  return planId;
}

/**
 * Get subscription details from PayPal
 */
export async function getSubscriptionDetails(subscriptionId: string): Promise<any> {
  try {
    return await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`);
  } catch (error: any) {
    console.error('Error getting subscription details:', error);
    throw new Error(`Failed to get subscription details: ${error.message}`);
  }
}

/**
 * Cancel a PayPal subscription
 */
export async function cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
  try {
    const body: any = {};
    if (reason) {
      body.reason = reason;
    }

    await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
}

/**
 * Suspend a PayPal subscription
 */
export async function suspendSubscription(subscriptionId: string, reason?: string): Promise<void> {
  try {
    const body: any = {};
    if (reason) {
      body.reason = reason;
    }

    await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/suspend`, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    console.error('Error suspending subscription:', error);
    throw new Error(`Failed to suspend subscription: ${error.message}`);
  }
}

/**
 * Reactivate a PayPal subscription
 */
export async function reactivateSubscription(subscriptionId: string, reason?: string): Promise<void> {
  try {
    const body: any = {};
    if (reason) {
      body.reason = reason;
    }

    await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/activate`, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    console.error('Error reactivating subscription:', error);
    throw new Error(`Failed to reactivate subscription: ${error.message}`);
  }
}

/**
 * Refund a PayPal transaction
 */
export async function refundTransaction(
  captureId: string,
  amount?: number,
  currency: string = 'USD',
  reason?: string,
): Promise<any> {
  try {
    const body: any = {};

    if (amount) {
      body.amount = {
        value: amount.toFixed(2),
        currency_code: currency,
      };
    }

    if (reason) {
      body.note_to_payer = reason;
    }

    return await paypalRequest(`/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error: any) {
    console.error('Error refunding transaction:', error);
    throw new Error(`Failed to refund transaction: ${error.message}`);
  }
}

/**
 * Generate PayPal invoice/transaction URL
 */
export function getPayPalTransactionUrl(transactionId: string): string {
  const isLive = Env.PAYPAL_MODE === 'live';
  const baseUrl = isLive
    ? 'https://www.paypal.com'
    : 'https://www.sandbox.paypal.com';

  return `${baseUrl}/activity/payment/${transactionId}`;
}

/**
 * Generate PayPal subscription management URL
 */
export function getPayPalSubscriptionUrl(subscriptionId: string): string {
  const isLive = Env.PAYPAL_MODE === 'live';
  const baseUrl = isLive
    ? 'https://www.paypal.com'
    : 'https://www.sandbox.paypal.com';

  return `${baseUrl}/myaccount/autopay/connect/${subscriptionId}`;
}
