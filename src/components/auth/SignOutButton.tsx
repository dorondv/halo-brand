'use client';

import { LogOut } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/libs/cn';

export function SignOutButton() {
  const t = useTranslations('DashboardLayout');
  const locale = useLocale();
  const isRTL = locale === 'he';

  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          'rounded-lg bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-2',
          'text-white font-medium flex items-center gap-2',
          'hover:from-pink-600 hover:to-orange-500 transition-all',
          isRTL ? 'flex-row-reverse' : '',
        )}
      >
        <LogOut className="h-4 w-4" />
        {t('sign_out')}
      </button>
    </form>
  );
}
