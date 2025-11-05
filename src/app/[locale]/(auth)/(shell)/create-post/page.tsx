import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function CreatePostPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }
  const t = await getTranslations('PageTitles');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('create_post')}</h1>
      <p className="text-gray-600">{t('coming_soon')}</p>
    </div>
  );
}
