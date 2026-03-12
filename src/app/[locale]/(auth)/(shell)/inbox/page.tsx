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
    <div className="flex h-full w-full flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex-1 overflow-hidden">
        <UnifiedInbox locale={locale} />
      </div>
    </div>
  );
}
