import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { ReportsExportClient } from './ReportsExportClient';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }
  return <ReportsExportClient />;
}
