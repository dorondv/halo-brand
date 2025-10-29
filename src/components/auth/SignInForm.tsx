'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/app/actions/auth';

export function SignInForm() {
  const [state, action, isPending] = useActionState(signIn, null);
  const t = useTranslations('Auth');

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email_label')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="m@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password_label')}</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t('signin_pending') : t('signin_cta')}
      </Button>
    </form>
  );
}
