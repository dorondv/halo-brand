import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_EMAIL } from '@/config/admin';
import { refundTransaction } from '@/libs/paypalService';
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

const refundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id: paymentId } = await params;

    const body = await request.json();
    const { amount, reason } = refundSchema.parse(body);

    const db = createDbConnection();
    const payment = await db
      .select({
        payment: billingHistory,
        subscription: subscriptions,
      })
      .from(billingHistory)
      .innerJoin(subscriptions, eq(billingHistory.subscriptionId, subscriptions.id))
      .where(eq(billingHistory.id, paymentId))
      .limit(1)
      .then(rows => rows[0]);

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (!payment.payment.paypalSaleId) {
      return NextResponse.json(
        { error: 'Payment does not have PayPal sale ID' },
        { status: 400 },
      );
    }

    // Check if refund is within 180 days
    const paymentDate = new Date(payment.payment.paymentDate);
    const daysSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSincePayment > 180) {
      return NextResponse.json(
        {
          error: 'Refund must be issued within 180 days of payment',
          message: 'Please use PayPal dashboard to issue refund manually',
        },
        { status: 400 },
      );
    }

    const refundAmount = amount || Number(payment.payment.amount);
    const remainingAmount = payment.payment.refundedAmount
      ? Number(payment.payment.amount) - Number(payment.payment.refundedAmount)
      : Number(payment.payment.amount);

    if (refundAmount > remainingAmount) {
      return NextResponse.json(
        {
          error: 'Refund amount exceeds remaining amount',
          remainingAmount,
        },
        { status: 400 },
      );
    }

    // Process refund via PayPal
    const refund = await refundTransaction(
      payment.payment.paypalSaleId,
      refundAmount,
      payment.payment.currency,
      reason,
    );

    // Update billing history
    const totalRefundedAmount = payment.payment.refundedAmount
      ? Number(payment.payment.refundedAmount) + refundAmount
      : refundAmount;
    const isFullRefund = totalRefundedAmount >= Number(payment.payment.amount);

    await db
      .update(billingHistory)
      .set({
        status: isFullRefund ? 'refunded' : 'partially_refunded',
        refundedAmount: totalRefundedAmount,
        refundedDate: new Date(),
        refundReason: reason || null,
      })
      .where(eq(billingHistory.id, paymentId));

    // If full refund, cancel subscription
    if (isFullRefund && payment.subscription.status === 'active') {
      await db
        .update(subscriptions)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, payment.subscription.id));
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      refundAmount,
      message: 'Refund processed successfully',
    });
  } catch (error: any) {
    console.error('Error processing refund:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to process refund', details: error.message },
      { status: 500 },
    );
  }
}
