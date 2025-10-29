import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/SupabaseServer';
import InboxClient from './InboxClient';

export default async function InboxPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) redirect('/sign-in');
    return <InboxClient />;
}


