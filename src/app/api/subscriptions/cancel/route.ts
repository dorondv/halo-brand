import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { cancelSubscription } from '@/libs/paypalService';
import { getUserSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { subscriptions } from '@/models/Schema';

export async function POST(_request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);

    if (!subscription || !subscription.paypalSubscriptionId) {
      return NextResponse.json({ error: 'No active PayPal subscription found' }, { status: 404 });
    }

    // Try to cancel in PayPal, but don't fail if PayPal API is unavailable
    let paypalCancelled = false;
    let paypalError: string | null = null;

    try {
      await cancelSubscription(subscription.paypalSubscriptionId);
      paypalCancelled = true;
      console.warn(`✅ Successfully cancelled PayPal subscription: ${subscription.paypalSubscriptionId}`);
    } catch (error: any) {
      console.error('⚠️  Failed to cancel subscription in PayPal:', error.message);
      paypalError = error.message;

      if (error.message?.includes('invalid_client') || error.message?.includes('Client Authentication failed')) {
        paypalError = 'PayPal API authentication failed. Subscription marked as cancelled in our system. Please cancel manually in PayPal if needed.';
      }
    }

    // Update subscription status in database regardless of PayPal API result
    await db
      .update(subscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(subscriptions.id, subscription.id));

    if (paypalCancelled) {
      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled successfully',
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Subscription marked as cancelled in our system',
        warning: paypalError || 'PayPal cancellation may need to be done manually',
        paypalSubscriptionId: subscription.paypalSubscriptionId,
      });
    }
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription', details: error.message }, { status: 500 });
  }
}
