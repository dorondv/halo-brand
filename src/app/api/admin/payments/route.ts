import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ADMIN_EMAIL } from '@/config/admin';
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

    const allPayments = await db
      .select({
        payment: billingHistory,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(billingHistory)
      .innerJoin(subscriptions, eq(billingHistory.subscriptionId, subscriptions.id))
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .orderBy(desc(billingHistory.createdAt));

    const paymentsData = allPayments.map(({ payment, user }) => ({
      id: payment.id,
      subscriptionId: payment.subscriptionId,
      invoiceNumber: payment.invoiceNumber,
      paypalTransactionId: payment.paypalTransactionId,
      paypalSaleId: payment.paypalSaleId,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      paymentDate: payment.paymentDate.toISOString(),
      refundedAmount: payment.refundedAmount ? Number(payment.refundedAmount) : null,
      refundedDate: payment.refundedDate?.toISOString() || null,
      refundReason: payment.refundReason,
      subscription: {
        user: {
          id: user.id,
          name: user.name || user.email?.split('@')[0] || 'User',
          email: user.email,
        },
      },
    }));

    return NextResponse.json(paymentsData);
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
