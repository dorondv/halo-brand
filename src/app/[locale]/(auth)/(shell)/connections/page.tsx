import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/SupabaseServer';
import ConnectionsClient from './ConnectionsClient';

export default async function ConnectionsPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/sign-in');
    return <ConnectionsClient />;
}


