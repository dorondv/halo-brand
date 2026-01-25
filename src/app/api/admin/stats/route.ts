import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { billingHistory, subscriptions } from '@/models/Schema';
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

    // Get subscription stats
    const subscriptionStats = await db
      .select({
        totalSubscriptions: sql<number>`count(*)::int`,
        activeSubscriptions: sql<number>`count(*) filter (where ${subscriptions.status} = 'active')::int`,
        trialSubscriptions: sql<number>`count(*) filter (where ${subscriptions.status} = 'trialing' or ${subscriptions.isTrialCoupon} = true)::int`,
        cancelledSubscriptions: sql<number>`count(*) filter (where ${subscriptions.status} = 'cancelled')::int`,
        freeSubscriptions: sql<number>`count(*) filter (where ${subscriptions.status} = 'free' or ${subscriptions.isFreeAccess} = true)::int`,
      })
      .from(subscriptions);

    // Get payment stats
    const paymentStats = await db
      .select({
        totalPayments: sql<number>`count(*)::int`,
        paidPayments: sql<number>`count(*) filter (where ${billingHistory.status} = 'paid')::int`,
        failedPayments: sql<number>`count(*) filter (where ${billingHistory.status} = 'failed')::int`,
        refundedPayments: sql<number>`count(*) filter (where ${billingHistory.status} = 'refunded' or ${billingHistory.status} = 'partially_refunded')::int`,
        totalRevenue: sql<number>`coalesce(sum(${billingHistory.amount}) filter (where ${billingHistory.status} = 'paid'), 0)`,
        totalRefunded: sql<number>`coalesce(sum(${billingHistory.refundedAmount}) filter (where ${billingHistory.refundedAmount} is not null), 0)`,
      })
      .from(billingHistory);

    const netRevenue = (paymentStats[0]?.totalRevenue || 0) - (paymentStats[0]?.totalRefunded || 0);

    return NextResponse.json({
      subscriptionStats: {
        totalSubscriptions: subscriptionStats[0]?.totalSubscriptions || 0,
        activeSubscriptions: subscriptionStats[0]?.activeSubscriptions || 0,
        trialSubscriptions: subscriptionStats[0]?.trialSubscriptions || 0,
        cancelledSubscriptions: subscriptionStats[0]?.cancelledSubscriptions || 0,
        freeSubscriptions: subscriptionStats[0]?.freeSubscriptions || 0,
        totalRevenue: Number(paymentStats[0]?.totalRevenue || 0),
      },
      paymentStats: {
        totalPayments: paymentStats[0]?.totalPayments || 0,
        paidPayments: paymentStats[0]?.paidPayments || 0,
        failedPayments: paymentStats[0]?.failedPayments || 0,
        refundedPayments: paymentStats[0]?.refundedPayments || 0,
        totalRevenue: Number(paymentStats[0]?.totalRevenue || 0),
        totalRefunded: Number(paymentStats[0]?.totalRefunded || 0),
        netRevenue: Number(netRevenue),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
