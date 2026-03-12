import { NextResponse } from 'next/server';
import { getUserSubscription, linkPayPalSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionID, planType, billingCycle: bodyBillingCycle } = body;

    if (!subscriptionID || !planType) {
      return NextResponse.json({ error: 'subscriptionID and planType are required' }, { status: 400 });
    }

    if (!['basic', 'pro', 'business'].includes(planType)) {
      return NextResponse.json({ error: 'planType must be "basic", "pro", or "business"' }, { status: 400 });
    }

    const billingCycle = (bodyBillingCycle || 'monthly') as 'monthly' | 'annual';

    // Validate billing cycle
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json({ error: 'billingCycle must be "monthly" or "annual"' }, { status: 400 });
    }

    // Check for duplicate subscription prevention
    const existingSubscription = await getUserSubscription(user.id);

    if (existingSubscription) {
      const hasSamePlan = existingSubscription.planType === planType;
      const hasPayments = existingSubscription.billingHistory && existingSubscription.billingHistory.length > 0;
      const isActive = existingSubscription.status === 'active' || existingSubscription.status === 'trialing';

      if (hasSamePlan && isActive && !hasPayments) {
        return NextResponse.json({
          error: `You already have an active ${planType} trial subscription. Please cancel it first or wait for it to end.`,
          code: 'DUPLICATE_TRIAL',
        }, { status: 400 });
      }

      if (hasSamePlan && isActive) {
        return NextResponse.json({
          error: `You already have an active ${planType} subscription. Please cancel it first before starting a new one.`,
          code: 'ACTIVE_SUBSCRIPTION_EXISTS',
        }, { status: 400 });
      }
    }

    const subscription = await linkPayPalSubscription(user.id, subscriptionID, planType as 'basic' | 'pro' | 'business', billingCycle);

    return NextResponse.json({
      success: true,
      subscription,
      message: 'Subscription linked successfully',
    });
  } catch (error: any) {
    console.error('Error linking subscription:', error);
    return NextResponse.json({
      error: 'Failed to link subscription',
      details: error.message,
    }, { status: 500 });
  }
}
