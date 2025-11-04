'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { signIn } from '@/app/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/libs/cn';

export function SignInForm() {
  const [state, action, isPending] = useActionState(signIn, null);
  const t = useTranslations('Auth');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <form action={action} className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-gray-900">
          {t('email_label')}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('email_placeholder')}
          required
          className="h-12 rounded-md border-gray-300"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium text-gray-900">
          {t('password_label')}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder={t('password_placeholder')}
          required
          className="h-12 rounded-md border-gray-300"
        />
      </div>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className={cn(
          'w-full h-12 text-lg rounded-md bg-gradient-to-r from-pink-500 to-pink-600 px-4 py-2',
          'text-white font-medium flex items-center justify-center gap-2',
          'hover:from-pink-600 hover:to-pink-600 transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isRTL ? 'flex-row-reverse' : '',
        )}
      >
        <ArrowIcon className="h-5 w-5" />
        {isPending ? t('signin_pending') : t('signin_cta')}
      </button>
    </form>
  );
}
