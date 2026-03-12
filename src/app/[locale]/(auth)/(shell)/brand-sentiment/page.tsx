import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { BrandSentimentClient } from './BrandSentimentClient';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function BrandSentimentPage() {
  // In Next.js 16, cookies() can only be called once per request
  // We need to share the cookie store between brand reading and Supabase client
  const cookieStore = await cookies();

  // Create Supabase client with shared cookie store (Next.js 16 best practice)
  const supabase = await createSupabaseServerClient(cookieStore);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }

  const subscription = await getUserSubscription(user.id);

  if (!subscription) {
    redirect('/pricing?feature=brand_sentiment');
  }

  const now = new Date();
  const isSubscriptionActive = subscription.status === 'active' || subscription.status === 'trialing';
  const isNotExpired = !subscription.endDate || new Date(subscription.endDate) > now;

  if (!isSubscriptionActive || !isNotExpired) {
    redirect('/pricing?feature=brand_sentiment');
  }

  const planType = subscription.planType || 'free';

  if (planType !== 'pro' && planType !== 'business') {
    redirect('/pricing?feature=brand_sentiment');
  }

  // Get selected brand from cookie
  const selectedBrandId = cookieStore.get('selected-brand-id')?.value || null;

  // Fetch brand name if selected
  let brandName = '';
  if (selectedBrandId) {
    const { data: brand } = await supabase
      .from('brands')
      .select('name')
      .eq('id', selectedBrandId)
      .eq('user_id', user.id)
      .maybeSingle();

    brandName = brand?.name || '';
  }

  return <BrandSentimentClient initialBrandName={brandName} />;
}
