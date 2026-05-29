/**
 * Single source of truth for whether a user may use the product.
 * Paid plans only — no standalone free/trial plan types.
 * Access: active PayPal subscription, admin-assigned paid plan, or valid coupon trial.
 */

export type SubscriptionAccessRow = {
  planType: string;
  status: string;
  paypalSubscriptionId?: string | null;
  endDate?: Date | string | null;
  trialEndDate?: Date | string | null;
  isFreeAccess?: boolean;
  isTrialCoupon?: boolean;
};

export const PAID_PLAN_TYPES = ['basic', 'pro', 'business'] as const;
export type PaidPlanType = (typeof PAID_PLAN_TYPES)[number];

export function isPaidPlanType(planType: string): planType is PaidPlanType {
  return PAID_PLAN_TYPES.includes(planType as PaidPlanType);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isPastDate(value: Date | string | null | undefined): boolean {
  const d = toDate(value);
  return d !== null && d.getTime() <= Date.now();
}

/** Routes reachable without an active paid/coupon subscription. */
export const SUBSCRIPTION_EXEMPT_BARE_PATHS = [
  '/pricing',
  '/settings',
  '/admin',
] as const;

export function isSubscriptionExemptPath(barePath: string): boolean {
  const normalized = barePath === '/' ? '/' : barePath.replace(/\/$/, '') || '/';
  return SUBSCRIPTION_EXEMPT_BARE_PATHS.some(
    p => normalized === p || normalized.startsWith(`${p}/`),
  );
}

/**
 * Whether the subscription row grants product access.
 */
export function hasSubscriptionAccess(subscription: SubscriptionAccessRow | null): boolean {
  if (!subscription) {
    return false;
  }

  if (subscription.status === 'suspended' || subscription.status === 'cancelled' || subscription.status === 'expired') {
    return false;
  }

  // Legacy free plan / admin free access — no longer grants access
  if (subscription.planType === 'free' || subscription.status === 'free' || subscription.isFreeAccess) {
    return false;
  }

  // Coupon trial (paid plan preferred; legacy plan_type=trial still honored until migrated)
  if (subscription.isTrialCoupon) {
    if (subscription.planType === 'trial' || isPaidPlanType(subscription.planType)) {
      return !isPastDate(subscription.endDate);
    }
    return false;
  }

  // Standalone trial plan without coupon — no access
  if (subscription.planType === 'trial') {
    return false;
  }

  if (!isPaidPlanType(subscription.planType)) {
    return false;
  }

  // PayPal subscription (active or in PayPal trial before first charge)
  if (subscription.paypalSubscriptionId) {
    if (subscription.status === 'active') {
      return true;
    }
    if (subscription.status === 'trialing') {
      if (subscription.trialEndDate && isPastDate(subscription.trialEndDate)) {
        return false;
      }
      return true;
    }
    return false;
  }

  // Admin-assigned paid plan (no PayPal link)
  if (subscription.status === 'active') {
    if (subscription.endDate && isPastDate(subscription.endDate)) {
      return false;
    }
    return true;
  }

  return false;
}

export function checkSubscriptionAccessFromRow(subscription: SubscriptionAccessRow | null): {
  hasFullAccess: boolean;
  canAccessSettings: boolean;
  canAccessPricing: boolean;
  expirationDate: Date | null;
  status: 'active' | 'trial' | 'expired' | 'none';
} {
  const base = {
    canAccessSettings: true,
    canAccessPricing: true,
  };

  if (!subscription || !hasSubscriptionAccess(subscription)) {
    return {
      ...base,
      hasFullAccess: false,
      expirationDate: toDate(subscription?.endDate ?? subscription?.trialEndDate),
      status: subscription ? 'expired' : 'none',
    };
  }

  const isTrial
    = subscription.isTrialCoupon
      || (subscription.status === 'trialing' && !!subscription.paypalSubscriptionId);

  return {
    ...base,
    hasFullAccess: true,
    expirationDate: toDate(subscription.endDate ?? subscription.trialEndDate),
    status: isTrial ? 'trial' : 'active',
  };
}
