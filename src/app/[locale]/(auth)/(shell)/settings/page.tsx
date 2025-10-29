import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/sign-in');
  }
  const t = await getTranslations('PageTitles');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('settings')}</h1>
      <p className="text-gray-600">{t('coming_soon')}</p>
    </div>
  );
}
