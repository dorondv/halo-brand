import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { UnifiedInbox } from '@/components/inbox/UnifiedInbox';
import { createSupabaseServerClient } from '@/libs/Supabase';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles');
  return {
    title: t('comments_center'),
  };
}

export default async function InboxPage() {
  const locale = await getLocale();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/${locale}/sign-in`);
  }

  const isRTL = locale === 'he';

  return (
    <div
      className="-my-6 flex h-[calc(100dvh-11rem)] min-h-[480px] w-full flex-col overflow-hidden bg-white dark:bg-gray-900"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <UnifiedInbox locale={locale} />
    </div>
  );
}
