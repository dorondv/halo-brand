import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { subscriptions, users } from '@/models/Schema';
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

export async function GET() {
  try {
    await requireAdmin();
    const db = createDbConnection();

    const allSubscriptions = await db
      .select({
        subscription: subscriptions,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .orderBy(desc(subscriptions.createdAt));

    const subscriptionsWithDetails = allSubscriptions.map(({ subscription, user }) => ({
      id: subscription.id,
      userId: subscription.userId,
      planType: subscription.planType,
      status: subscription.status,
      paypalSubscriptionId: subscription.paypalSubscriptionId,
      paypalPlanId: subscription.paypalPlanId,
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate?.toISOString() || null,
      trialEndDate: subscription.trialEndDate?.toISOString() || null,
      price: Number(subscription.price),
      currency: subscription.currency,
      isPayPalTrial: false, // TODO: Check PayPal trial status
      user: {
        id: user.id,
        name: user.name || user.email?.split('@')[0] || 'User',
        email: user.email,
      },
    }));

    return NextResponse.json(subscriptionsWithDetails);
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}
