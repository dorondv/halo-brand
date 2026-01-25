import { NextResponse } from 'next/server';
import { getPayPalClientId, getPayPalPlanId } from '@/libs/paypalService';
import { getSubscriptionPlan } from '@/libs/subscriptionService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planParam = searchParams.get('plan') as 'basic' | 'pro' | 'business' | null;
    const billingParam = (searchParams.get('billing') || 'monthly') as 'monthly' | 'annual';

    const clientId = getPayPalClientId();
    const mode = process.env.PAYPAL_MODE || 'sandbox';

    // If a specific plan is requested, return its PayPal plan ID
    if (planParam && ['basic', 'pro', 'business'].includes(planParam)) {
      // Try to get plan from database first
      const plan = await getSubscriptionPlan(planParam);
      // Use the correct plan ID based on billing cycle (monthly/annual)
      const planId = plan?.paypalPlanId || getPayPalPlanId(planParam, billingParam);

      return NextResponse.json({
        clientId,
        mode,
        planId,
        billing: billingParam,
      });
    }

    // Return all plan IDs for backward compatibility (defaulting to monthly)
    return NextResponse.json({
      clientId,
      mode,
      planIds: {
        basic: {
          monthly: getPayPalPlanId('basic', 'monthly'),
          annual: getPayPalPlanId('basic', 'annual'),
        },
        pro: {
          monthly: getPayPalPlanId('pro', 'monthly'),
          annual: getPayPalPlanId('pro', 'annual'),
        },
        business: {
          monthly: getPayPalPlanId('business', 'monthly'),
          annual: getPayPalPlanId('business', 'annual'),
        },
      },
    });
  } catch (error: any) {
    console.error('Error getting PayPal Client ID:', error);
    return NextResponse.json({
      error: 'Failed to get PayPal Client ID',
      message: error.message || 'PayPal Client ID not configured. Please set PAYPAL_CLIENT_ID in your .env file.',
      details: 'Add PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_MODE to your .env file',
    }, { status: 500 });
  }
}
