import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { createBillingHistory } from '@/libs/subscriptionService';
import { paymentWebhooks, subscriptions } from '@/models/Schema';

/**
 * Verify PayPal webhook signature using PayPal's verification API.
 * Returns true if the signature is valid, false otherwise.
 * If PAYPAL_WEBHOOK_ID is not configured, logs a warning and rejects the request.
 */
async function verifyWebhookSignature(request: Request, body: unknown): Promise<boolean> {
  const webhookId = Env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error('PAYPAL_WEBHOOK_ID is not configured. Rejecting webhook for safety.');
    return false;
  }

  const transmissionId = request.headers.get('paypal-transmission-id');
  const transmissionTime = request.headers.get('paypal-transmission-time');
  const transmissionSig = request.headers.get('paypal-transmission-sig');
  const certUrl = request.headers.get('paypal-cert-url');
  const authAlgo = request.headers.get('paypal-auth-algo');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    console.warn('Missing PayPal webhook signature headers');
    return false;
  }

  try {
    const paypalBaseUrl = Env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Get PayPal access token for verification API
    const clientId = Env.PAYPAL_CLIENT_ID;
    const clientSecret = Env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('PayPal credentials not configured for webhook verification');
      return false;
    }

    // eslint-disable-next-line node/prefer-global/buffer
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      console.error('Failed to get PayPal token for webhook verification');
      return false;
    }

    const tokenData = await tokenResponse.json();

    // Call PayPal's webhook signature verification endpoint
    const verifyResponse = await fetch(`${paypalBaseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: body,
      }),
    });

    if (!verifyResponse.ok) {
      console.error('PayPal webhook verification API returned error:', verifyResponse.status);
      return false;
    }

    const verifyData = await verifyResponse.json();
    return verifyData.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('Error verifying PayPal webhook signature:', error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verify webhook signature before processing
    const isValid = await verifyWebhookSignature(request, body);
    if (!isValid) {
      console.warn('PayPal webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing webhook:', error);

      // Mark webhook with error
      await db
        .update(paymentWebhooks)
        .set({ error: errorMessage, processed: true, processedAt: new Date() })
        .where(eq(paymentWebhooks.paypalEventId, paypalEventId));

      return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
