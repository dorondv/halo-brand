import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/SupabaseServer';

export default async function HomePage() {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/sign-in');
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Home</h1>
            <p className="text-gray-600">Welcome back</p>
        </div>
    );
}


