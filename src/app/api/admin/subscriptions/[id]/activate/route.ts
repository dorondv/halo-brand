import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { getSubscriptionDetails, reactivateSubscription } from '@/libs/paypalService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { subscriptions } from '@/models/Schema';
import { createDbConnection } from '@/utils/DBConnection';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  // Check if user email is the admin email
  if (user.email !== ADMIN_EMAIL) {
    throw new Error('Admin access required');
  }

  return user.id;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id: subscriptionId } = await params;

    const db = createDbConnection();
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
      .then(rows => rows[0]);

    if (!subscription || !subscription.paypalSubscriptionId) {
      return NextResponse.json(
        { error: 'PayPal subscription not found' },
        { status: 404 },
      );
    }

    // Check local database status first
    // Only allow reactivation if subscription is SUSPENDED in our database
    if (subscription.status !== 'suspended') {
      return NextResponse.json(
        {
          error: 'Cannot reactivate subscription',
          details: `Subscription status in our database is "${subscription.status}". Only SUSPENDED subscriptions can be reactivated.`,
          currentStatus: subscription.status,
          suggestion:
            subscription.status === 'cancelled'
              ? 'Cancelled subscriptions cannot be reactivated. User needs to create a new subscription.'
              : subscription.status === 'expired'
                ? 'Expired subscriptions cannot be reactivated. User needs to create a new subscription.'
                : `Subscription status "${subscription.status}" does not support reactivation.`,
        },
        { status: 400 },
      );
    }

    // Check PayPal subscription status before attempting reactivation
    // PayPal only allows reactivating SUSPENDED subscriptions, not CANCELLED ones
    let paypalSub;
    try {
      paypalSub = await getSubscriptionDetails(subscription.paypalSubscriptionId);
    } catch (error: any) {
      console.error('Error fetching PayPal subscription details:', error);
      return NextResponse.json(
        {
          error: 'Failed to verify PayPal subscription status',
          details: error.message,
        },
        { status: 500 },
      );
    }

    // Verify PayPal subscription is actually suspended
    if (paypalSub.status !== 'SUSPENDED') {
      return NextResponse.json(
        {
          error: 'Cannot reactivate subscription',
          details: `PayPal subscription status is "${paypalSub.status}". Only SUSPENDED subscriptions can be reactivated.`,
          currentPayPalStatus: paypalSub.status,
          suggestion:
            paypalSub.status === 'CANCELLED'
              ? 'Cancelled subscriptions cannot be reactivated. User needs to create a new subscription.'
              : `PayPal subscription status "${paypalSub.status}" does not support reactivation.`,
        },
        { status: 400 },
      );
    }

    // Reactivate in PayPal
    await reactivateSubscription(subscription.paypalSubscriptionId, 'Activated by admin');

    // Update database
    await db
      .update(subscriptions)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));

    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully',
    });
  } catch (error: any) {
    console.error('Error activating subscription:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to activate subscription', details: error.message },
      { status: 500 },
    );
  }
}
