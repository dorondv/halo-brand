import { redirect } from 'next/navigation';
import { PaymentClient } from '@/components/pricing/PaymentClient';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const dynamic = 'force-dynamic';

export default async function PaymentPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }
  return <PaymentClient />;
}
