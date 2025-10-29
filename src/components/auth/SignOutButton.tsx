'use client';

import { signOut } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export function SignOutButton() {
  const t = useTranslations('DashboardLayout');
  return (
    <form action={signOut}>
      <Button type="submit">{t('sign_out')}</Button>
    </form>
  );
}
