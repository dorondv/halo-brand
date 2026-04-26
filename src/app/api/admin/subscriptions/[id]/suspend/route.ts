import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { suspendSubscription } from '@/libs/paypalService';
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

    // Suspend in PayPal
    await suspendSubscription(subscription.paypalSubscriptionId, 'Suspended by admin');

    // Update database
    await db
      .update(subscriptions)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));

    return NextResponse.json({
      success: true,
      message: 'Subscription suspended successfully',
    });
  } catch (error: any) {
    console.error('Error suspending subscription:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to suspend subscription', details: error.message },
      { status: 500 },
    );
  }
}
