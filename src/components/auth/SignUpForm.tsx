'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { signUp } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SignUpForm() {
  const [state, action, isPending] = useActionState(signUp, null);
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
      {state?.message && <p className="text-green-500">{state.message}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t('signup_pending') : t('signup_cta')}
      </Button>
    </form>
  );
}
