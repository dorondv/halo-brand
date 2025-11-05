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
          'flex w-full items-center rounded-lg px-4 py-3 text-gray-700',
          'transition-colors duration-200 hover:bg-gray-100 cursor-pointer',
          isRTL ? 'gap-4' : 'gap-2',
        )}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span>{t('sign_out')}</span>
      </button>
    </form>
  );
}
