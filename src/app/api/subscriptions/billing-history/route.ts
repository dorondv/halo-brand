import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { getPayPalSubscriptionUrl, getPayPalTransactionUrl } from '@/libs/paypalService';
import { getUserSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { billingHistory } from '@/models/Schema';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);

    if (!subscription) {
      return NextResponse.json([]);
    }

    const history = await db
      .select()
      .from(billingHistory)
      .where(eq(billingHistory.subscriptionId, subscription.id))
      .orderBy(desc(billingHistory.paymentDate));

    // Add PayPal invoice URLs
    const historyWithUrls = history.map((item) => {
      let invoiceUrl = item.invoiceUrl;

      if (!invoiceUrl && item.paypalTransactionId) {
        try {
          invoiceUrl = getPayPalTransactionUrl(item.paypalTransactionId);
        } catch (error) {
          console.error('Error generating PayPal transaction URL:', error);
        }
      }

      return {
        ...item,
        invoiceUrl,
        paypalSubscriptionUrl: subscription.paypalSubscriptionId
          ? getPayPalSubscriptionUrl(subscription.paypalSubscriptionId)
          : null,
      };
    });

    return NextResponse.json(historyWithUrls);
  } catch (error: any) {
    console.error('Error getting billing history:', error);
    return NextResponse.json({ error: 'Failed to get billing history' }, { status: 500 });
  }
}
