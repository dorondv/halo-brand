import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { PostSentimentClient } from './PostSentimentClient';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function PostSentimentPage() {
  // In Next.js 16, cookies() can only be called once per request
  const cookieStore = await cookies();

  // Create Supabase client with shared cookie store (Next.js 16 best practice)
  const supabase = await createSupabaseServerClient(cookieStore);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }

  return <PostSentimentClient />;
}
