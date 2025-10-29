import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/SupabaseServer';
import AnalyticsClient from './AnalyticsClient';

export default async function AnalyticsPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/sign-in');
    return <AnalyticsClient />;
}


