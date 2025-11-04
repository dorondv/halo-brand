'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import { signInWithFacebook, signInWithGoogle, signUp } from '@/app/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/libs/cn';

// OAuth Provider Icons
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const FacebookIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
  </svg>
);

export function SignUpForm() {
  const [state, action, isPending] = useActionState(signUp, null);
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isFacebookPending, startFacebookTransition] = useTransition();
  const t = useTranslations('Auth');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const handleGoogleSignIn = () => {
    startGoogleTransition(async () => {
      await signInWithGoogle();
    });
  };

  const handleFacebookSignIn = () => {
    startFacebookTransition(async () => {
      await signInWithFacebook();
    });
  };

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* OAuth Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGooglePending || isFacebookPending || isPending}
          className={cn(
            'w-full h-12 rounded-md border-2 border-gray-300 bg-white px-4 py-2',
            'text-gray-700 font-medium flex items-center justify-center gap-3',
            'hover:bg-gray-50 hover:border-gray-400 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isRTL ? 'flex-row-reverse' : '',
          )}
        >
          <GoogleIcon />
          {isGooglePending ? t('oauth_loading') : t('oauth_google')}
        </button>

        <button
          type="button"
          onClick={handleFacebookSignIn}
          disabled={isGooglePending || isFacebookPending || isPending}
          className={cn(
            'w-full h-12 rounded-md border-2 border-gray-300 bg-white px-4 py-2',
            'text-gray-700 font-medium flex items-center justify-center gap-3',
            'hover:bg-gray-50 hover:border-gray-400 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isRTL ? 'flex-row-reverse' : '',
          )}
        >
          <FacebookIcon />
          {isFacebookPending ? t('oauth_loading') : t('oauth_facebook')}
        </button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">{t('oauth_divider')}</span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium text-gray-900">
            {t('full_name_label')}
          </Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            placeholder={t('full_name_placeholder')}
            required
            className="h-12 rounded-md border-gray-300"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-sm font-medium text-gray-900">
            {t('company_brand_label')}
          </Label>
          <Input
            id="companyName"
            name="companyName"
            type="text"
            placeholder={t('company_brand_placeholder')}
            required
            className="h-12 rounded-md border-gray-300"
          />
        </div>
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
        {state?.message && <p className="text-sm text-green-500">{state.message}</p>}
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'w-full h-12 text-lg rounded-md bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-2',
            'text-white font-medium flex items-center justify-center gap-2',
            'hover:from-pink-600 hover:to-orange-500 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isRTL ? 'flex-row-reverse' : '',
          )}
        >
          <ArrowIcon className="h-5 w-5" />
          {isPending ? t('signup_pending') : t('signup_button')}
        </button>
        <p className="text-center text-xs text-gray-600">
          {t('signup_disclaimer')}
        </p>
      </form>
    </div>
  );
}
