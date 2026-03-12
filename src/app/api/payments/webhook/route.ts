import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { createBillingHistory } from '@/libs/subscriptionService';
import { paymentWebhooks, subscriptions } from '@/models/Schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Store webhook event
    const paypalEventId = body.id || body.event_version || `event_${Date.now()}`;
    const eventType = body.event_type || body.type || 'UNKNOWN';

    // Check if we've already processed this event
    const [existingWebhook] = await db
      .select()
      .from(paymentWebhooks)
      .where(eq(paymentWebhooks.paypalEventId, paypalEventId))
      .limit(1);

    if (existingWebhook && existingWebhook.processed) {
      console.warn(`Webhook ${paypalEventId} already processed`);
      return NextResponse.json({ message: 'Event already processed' });
    }

    // Store webhook event
    await db.insert(paymentWebhooks).values({
      paypalEventId,
      eventType,
      payload: body,
      processed: false,
    }).onConflictDoUpdate({
      target: paymentWebhooks.paypalEventId,
      set: {
        payload: body,
        processed: false,
      },
    });

    // Process webhook based on event type
    try {
      if (eventType === 'BILLING.SUBSCRIPTION.CREATED') {
        console.warn('Subscription created:', body.resource?.id);
        // Subscription linking is handled in the /api/subscriptions/link endpoint
      } else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
        const subscriptionId = body.resource?.id;
        if (subscriptionId) {
          await db
            .update(subscriptions)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(subscriptions.paypalSubscriptionId, subscriptionId));
        }
      } else if (eventType === 'PAYMENT.SALE.COMPLETED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = body.resource;
        const subscriptionId = resource?.billing_agreement_id || resource?.subscription_id;

        if (subscriptionId) {
          // Find subscription
          const [subscription] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.paypalSubscriptionId, subscriptionId))
            .limit(1);

          if (subscription) {
            // Create billing history record
            const transactionId = resource.id || resource.transaction_id;
            const amount = Number.parseFloat(resource.amount?.value || resource.amount?.total || '0');

            await createBillingHistory(subscription.id, {
              invoiceNumber: `INV-${Date.now()}`,
              paypalTransactionId: transactionId,
              paypalSaleId: resource.id,
              amount,
              currency: resource.amount?.currency_code || 'USD',
              status: 'paid',
              paymentDate: new Date(resource.create_time || Date.now()),
            });

            // Update subscription status to active
            await db
              .update(subscriptions)
              .set({ status: 'active', updatedAt: new Date() })
              .where(eq(subscriptions.id, subscription.id));
          }
        }
      }

      // Mark webhook as processed
      await db
        .update(paymentWebhooks)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(paymentWebhooks.paypalEventId, paypalEventId));

      return NextResponse.json({ message: 'Webhook processed successfully' });
    } catch (error: any) {
      console.error('Error processing webhook:', error);

      // Mark webhook with error
      await db
        .update(paymentWebhooks)
        .set({ error: error.message, processed: true, processedAt: new Date() })
        .where(eq(paymentWebhooks.paypalEventId, paypalEventId));

      return NextResponse.json({ error: 'Failed to process webhook', details: error.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
