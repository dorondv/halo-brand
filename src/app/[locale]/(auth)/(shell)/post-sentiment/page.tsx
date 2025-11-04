import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function PostSentimentPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Post Sentiment</h1>
      <p className="text-gray-600">Coming soon</p>
    </div>
  );
}
