import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/Supabase';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="text-gray-600">Welcome back</p>
    </div>
  );
}
