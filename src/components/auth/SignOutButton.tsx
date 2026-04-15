'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/libs/cn';

export function SignOutButton() {
  const t = useTranslations('DashboardLayout');

  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300',
          'transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800',
        )}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="leading-snug">{t('sign_out')}</span>
      </button>
    </form>
  );
}
