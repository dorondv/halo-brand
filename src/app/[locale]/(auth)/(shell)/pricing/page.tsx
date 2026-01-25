import { redirect } from 'next/navigation';
import { PricingClient } from '@/components/pricing/PricingClient';
import { createSupabaseServerClient } from '@/libs/Supabase';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }
  return <PricingClient />;
}
