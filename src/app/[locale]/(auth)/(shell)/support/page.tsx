import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/SupabaseServer';
import SupportClient from './SupportClient';

export default async function SupportPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/sign-in');
    return <SupportClient />;
}


