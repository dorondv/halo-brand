import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { billingHistory, subscriptionPlans, subscriptions } from '@/models/Schema';
import { db } from './DB';
import { getPayPalPlanId, getSubscriptionDetails } from './paypalService';

export type PlanType = 'basic' | 'pro' | 'business' | 'free' | 'trial';
export type SubscriptionStatus = 'trialing' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'free';

type Subscription = InferSelectModel<typeof subscriptions>;
type SubscriptionPlan = InferSelectModel<typeof subscriptionPlans>;

/**
 * Calculate trial end date
 */
export function calculateTrialEndDate(days: number = 7): Date {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}

/**
 * Extract trial end date from PayPal subscription details
 */
export function extractTrialEndDateFromPayPal(paypalSubscriptionDetails: any): Date | null {
  if (!paypalSubscriptionDetails) {
    return null;
  }

  // Method 1: Check for trial_ended_at in billing_info
  if (paypalSubscriptionDetails.billing_info?.trial_ended_at) {
    return new Date(paypalSubscriptionDetails.billing_info.trial_ended_at);
  }

  // Method 2: Calculate from billing_cycles (trial cycle)
  if (paypalSubscriptionDetails.billing_cycles) {
    const trialCycle = paypalSubscriptionDetails.billing_cycles.find(
      (cycle: any) => cycle.tenure_type === 'TRIAL',
    );

    if (trialCycle) {
      const startTime = paypalSubscriptionDetails.start_time
        || paypalSubscriptionDetails.create_time
        || paypalSubscriptionDetails.billing_info?.next_billing_time;

      if (startTime && trialCycle.frequency) {
        const startDate = new Date(startTime);
        const intervalCount = trialCycle.frequency.interval_count || 1;
        const intervalUnit = trialCycle.frequency.interval_unit || 'DAY';

        const trialEndDate = new Date(startDate);

        if (intervalUnit === 'DAY') {
          trialEndDate.setDate(trialEndDate.getDate() + intervalCount);
        } else if (intervalUnit === 'WEEK') {
          trialEndDate.setDate(trialEndDate.getDate() + (intervalCount * 7));
        } else if (intervalUnit === 'MONTH') {
          trialEndDate.setMonth(trialEndDate.getMonth() + intervalCount);
        } else if (intervalUnit === 'YEAR') {
          trialEndDate.setFullYear(trialEndDate.getFullYear() + intervalCount);
        }

        return trialEndDate;
      }
    }
  }

  // Method 3: Use next_billing_time as trial end (if no payments yet)
  if (paypalSubscriptionDetails.billing_info?.next_billing_time) {
    return new Date(paypalSubscriptionDetails.billing_info.next_billing_time);
  }

  return null;
}

/**
 * Create a subscription record
 */
export async function createSubscription(
  userId: string,
  planType: PlanType,
  options: {
    paypalSubscriptionId?: string;
    paypalPlanId?: string;
    price: number;
    currency?: string;
    couponCode?: string;
    couponId?: string;
    isFreeAccess?: boolean;
    isTrialCoupon?: boolean;
    grantedByAdminId?: string;
    endDate?: Date;
    trialEndDate?: Date;
    billingCycle?: 'monthly' | 'annual';
  },
) {
  const {
    paypalSubscriptionId,
    paypalPlanId,
    price,
    currency = 'USD',
    couponCode,
    couponId,
    isFreeAccess = false,
    isTrialCoupon = false,
    grantedByAdminId,
    endDate,
    trialEndDate,
    billingCycle = 'monthly',
  } = options;

  // Determine status based on plan type
  let status: SubscriptionStatus = 'active';
  if (planType === 'free' || planType === 'trial') {
    status = planType === 'free' ? 'free' : 'trialing';
  } else if (paypalSubscriptionId) {
    status = 'active';
  }

  // Get PayPal plan ID if not provided
  const finalPaypalPlanId = paypalPlanId || (planType !== 'free' && planType !== 'trial'
    ? getPayPalPlanId(planType as 'basic' | 'pro' | 'business', billingCycle)
    : null);

  const [subscription] = await db.insert(subscriptions).values({
    userId,
    planType,
    status,
    paypalSubscriptionId: paypalSubscriptionId || null,
    paypalPlanId: finalPaypalPlanId || null,
    startDate: new Date(),
    endDate: endDate || null,
    trialEndDate: trialEndDate || null,
    price,
    currency,
    couponCode: couponCode || null,
    couponId: couponId || null,
    isFreeAccess,
    isTrialCoupon,
    grantedByAdminId: grantedByAdminId || null,
  }).returning();

  return subscription;
}

/**
 * Get user's subscription
 */
export async function getUserSubscription(userId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!subscription) {
    return null;
  }

  // Get billing history
  const history = await db
    .select()
    .from(billingHistory)
    .where(eq(billingHistory.subscriptionId, subscription.id))
    .orderBy(billingHistory.paymentDate);

  return {
    ...subscription,
    billingHistory: history,
  };
}

/**
 * Get subscription plan details
 */
export async function getSubscriptionPlan(planKey: 'basic' | 'pro' | 'business'): Promise<SubscriptionPlan | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.planKey, planKey))
    .limit(1);

  return plan || null;
}

/**
 * Get all active subscription plans
 */
export async function getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.displayOrder);
}

/**
 * Link PayPal subscription to user
 */
export async function linkPayPalSubscription(
  userId: string,
  paypalSubscriptionId: string,
  planType: 'basic' | 'pro' | 'business',
  billingCycle: 'monthly' | 'annual' = 'monthly',
) {
  // Fetch subscription details from PayPal to get trial period info
  let paypalSubscriptionDetails: any = null;
  let trialEndDate: Date | null = null;

  try {
    paypalSubscriptionDetails = await getSubscriptionDetails(paypalSubscriptionId);
    trialEndDate = extractTrialEndDateFromPayPal(paypalSubscriptionDetails);
  } catch (error: any) {
    console.warn('Could not fetch PayPal subscription details for trial period:', error.message);
  }

  // Check if user already has a subscription
  const existingSubscription = await getUserSubscription(userId);

  // Get plan details to get price
  const plan = await getSubscriptionPlan(planType);
  if (!plan) {
    throw new Error(`Plan ${planType} not found`);
  }

  const paypalPlanId = plan.paypalPlanId || getPayPalPlanId(planType, billingCycle);
  const price = billingCycle === 'annual' && plan.priceAnnual
    ? plan.priceAnnual / 12 // Store monthly equivalent for annual plans
    : plan.priceMonthly;

  // Handle upgrade/downgrade
  if (existingSubscription && existingSubscription.planType !== planType) {
    console.warn(`🔄 Changing user ${userId} subscription from ${existingSubscription.planType} to ${planType}`);

    const subscriptionData: any = {
      planType,
      billingCycle,
      status: (trialEndDate && new Date() < trialEndDate ? 'trialing' : 'active') as SubscriptionStatus,
      paypalSubscriptionId,
      paypalPlanId,
      price,
      updatedAt: new Date(),
    };

    if (trialEndDate) {
      subscriptionData.trialEndDate = trialEndDate;
    }

    const [updated] = await db
      .update(subscriptions)
      .set(subscriptionData)
      .where(eq(subscriptions.id, existingSubscription.id))
      .returning();

    return updated;
  }

  // Handle regular subscription linking
  let finalTrialEndDate = trialEndDate;

  if (!finalTrialEndDate && !existingSubscription) {
    finalTrialEndDate = calculateTrialEndDate(5); // 5 days trial for new users
  }

  const subscriptionData: any = {
    planType,
    billingCycle,
    status: (finalTrialEndDate && new Date() < finalTrialEndDate ? 'trialing' : 'active') as SubscriptionStatus,
    paypalSubscriptionId,
    paypalPlanId,
    price,
    updatedAt: new Date(),
  };

  if (finalTrialEndDate) {
    subscriptionData.trialEndDate = finalTrialEndDate;
  }

  if (existingSubscription) {
    const [updated] = await db
      .update(subscriptions)
      .set(subscriptionData)
      .where(eq(subscriptions.id, existingSubscription.id))
      .returning();
    return updated;
  } else {
    return await createSubscription(userId, planType, {
      paypalSubscriptionId,
      paypalPlanId,
      price,
      trialEndDate: finalTrialEndDate || undefined,
      billingCycle,
    });
  }
}

/**
 * Check subscription access
 */
export function checkSubscriptionAccess(subscription: Subscription | null): {
  hasFullAccess: boolean;
  canAccessSettings: boolean;
  canAccessPricing: boolean;
  expirationDate: Date | null;
  status: 'active' | 'trial' | 'expired' | 'none';
} {
  // Settings and pricing are always accessible

  if (!subscription) {
    return {
      hasFullAccess: false,
      canAccessSettings: true,
      canAccessPricing: true,
      expirationDate: null,
      status: 'none',
    };
  }

  if (subscription.status === 'suspended') {
    return {
      hasFullAccess: false,
      canAccessSettings: true,
      canAccessPricing: true,
      expirationDate: subscription.endDate || null,
      status: 'expired',
    };
  }

  if (subscription.status === 'active' && subscription.paypalSubscriptionId) {
    return {
      hasFullAccess: true,
      canAccessSettings: true,
      canAccessPricing: true,
      expirationDate: subscription.endDate || null,
      status: 'active',
    };
  }

  if (subscription.planType === 'free' || subscription.planType === 'trial') {
    const isExpired = subscription.endDate
      ? new Date() > subscription.endDate
      : false;

    return {
      hasFullAccess: !isExpired,
      canAccessSettings: true,
      canAccessPricing: true,
      expirationDate: subscription.endDate || null,
      status: isExpired ? 'expired' : 'trial',
    };
  }

  return {
    hasFullAccess: false,
    canAccessSettings: true,
    canAccessPricing: true,
    expirationDate: subscription.endDate || null,
    status: 'expired',
  };
}

/**
 * Get user status based on subscription
 */
export function getUserStatus(subscription: Subscription | null): 'Free trial' | 'Active user (Paid)' | 'Churned' | 'Free access' {
  if (!subscription) {
    return 'Churned';
  }

  if (subscription.isFreeAccess && subscription.planType === 'free') {
    if (subscription.status === 'expired') {
      return 'Churned';
    }
    const isExpired = subscription.endDate
      ? new Date() > subscription.endDate
      : false;
    return isExpired ? 'Churned' : 'Free access';
  }

  if (subscription.isTrialCoupon && subscription.planType === 'trial') {
    const isExpired = subscription.endDate
      ? new Date() > subscription.endDate
      : false;
    return isExpired ? 'Churned' : 'Free trial';
  }

  if (subscription.status === 'suspended') {
    return 'Churned';
  }

  if (subscription.status === 'active' && subscription.paypalSubscriptionId) {
    return 'Active user (Paid)';
  }

  if (subscription.status === 'trialing' && subscription.paypalSubscriptionId) {
    return 'Free trial';
  }

  if (subscription.status === 'cancelled' || subscription.status === 'expired') {
    return 'Churned';
  }

  if ((subscription.planType === 'free' || subscription.planType === 'trial') && subscription.endDate) {
    if (new Date() > subscription.endDate) {
      return 'Churned';
    }
    return subscription.isFreeAccess ? 'Free access' : 'Free trial';
  }

  return 'Churned';
}

/**
 * Create billing history record
 */
export async function createBillingHistory(
  subscriptionId: string,
  data: {
    invoiceNumber: string;
    paypalTransactionId?: string;
    paypalSaleId?: string;
    amount: number;
    currency?: string;
    status: string;
    paymentDate: Date;
    invoiceUrl?: string;
  },
) {
  const [history] = await db.insert(billingHistory).values({
    subscriptionId,
    invoiceNumber: data.invoiceNumber,
    paypalTransactionId: data.paypalTransactionId || null,
    paypalSaleId: data.paypalSaleId || null,
    amount: data.amount,
    currency: data.currency || 'USD',
    status: data.status,
    paymentDate: data.paymentDate,
    invoiceUrl: data.invoiceUrl || null,
  }).returning();

  return history;
}
