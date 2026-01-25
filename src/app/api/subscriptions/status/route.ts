import { NextResponse } from 'next/server';
import { checkSubscriptionAccess, getUserStatus, getUserSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
        access: {
          hasFullAccess: false,
          canAccessSettings: true,
          canAccessPricing: true,
          expirationDate: null,
          status: 'none',
        },
        userStatus: 'Churned',
      });
    }

    const access = checkSubscriptionAccess(subscription);
    const userStatus = getUserStatus(subscription);

    return NextResponse.json({
      subscription,
      access,
      userStatus,
    });
  } catch (error: any) {
    console.error('Error getting subscription status:', error);
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 });
  }
}
