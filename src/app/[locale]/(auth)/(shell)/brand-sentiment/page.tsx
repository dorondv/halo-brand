import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function BrandSentimentPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/sign-in');
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Brand Sentiment</h1>
      <p className="text-gray-600">Coming soon</p>
    </div>
  );
}
