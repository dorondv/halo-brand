import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/SupabaseServer';

export default async function PostSentimentPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/sign-in');
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Post Sentiment</h1>
            <p className="text-gray-600">Coming soon</p>
        </div>
    );
}


