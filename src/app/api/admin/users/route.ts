import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
import { getUserStatus } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { billingHistory, subscriptions, users } from '@/models/Schema';
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

    // Get all users with their subscriptions and payment info
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

    const usersWithDetails = await Promise.all(
      allUsers.map(async (user) => {
        const userSubscriptions = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, user.id))
          .limit(1);

        const subscription = userSubscriptions[0] || null;

        // Get total paid amount
        const payments = await db
          .select({
            totalPaid: sql<number>`coalesce(sum(${billingHistory.amount}) filter (where ${billingHistory.status} = 'paid'), 0)`,
          })
          .from(billingHistory)
          .innerJoin(subscriptions, eq(billingHistory.subscriptionId, subscriptions.id))
          .where(eq(subscriptions.userId, user.id));

        const totalPaid = Number(payments[0]?.totalPaid || 0);

        // Check if coupon was used
        const couponUsed = !!subscription?.couponCode;

        // Get user status
        const userStatus = subscription ? getUserStatus(subscription) : 'Churned';

        return {
          id: user.id,
          name: user.name || user.email?.split('@')[0] || 'User',
          email: user.email,
          role: 'contributor', // TODO: Add role field
          registrationDate: user.createdAt.toISOString(),
          paymentDate: subscription?.startDate?.toISOString() || null,
          userStatus,
          planType: subscription?.planType || null,
          totalPaid,
          couponUsed,
          discountAmount: 0, // TODO: Calculate from coupon
          trialEndDate: subscription?.trialEndDate?.toISOString() || null,
          expirationDate: subscription?.endDate?.toISOString() || null,
          isFreeAccess: subscription?.isFreeAccess || false,
          isPayPalTrial: false, // TODO: Check PayPal trial status
          paypalTrialEndDate: null,
          isTrialCoupon: subscription?.isTrialCoupon || false,
          subscription,
        };
      }),
    );

    return NextResponse.json(usersWithDetails);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
