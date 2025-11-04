import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/Logo';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function SignUpPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect('/dashboard');
  }
  const t = await getTranslations('Auth');
  const locale = await getLocale();
  const isRTL = locale === 'he';

  return (
    <div className="absolute inset-0 min-h-screen w-screen bg-gradient-to-br from-pink-50 via-white to-pink-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Locale Switcher - Top Right */}
      <div className={`absolute top-6 z-10 ${isRTL ? 'left-6' : 'right-6'}`}>
        <LocaleSwitcher />
      </div>

      {/* Header */}
      <header className="container mx-auto px-6 pt-6 pb-2">
        <div className="flex items-center justify-center">
          <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-[#FF0083] to-[#FF3399] p-1">
            <Logo width={140} height={35} className="text-white" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 pt-4 pb-12">
        <div className="mx-auto max-w-md">
          <Card className="rounded-lg border-0 bg-white/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="pb-4 text-center">
              <CardTitle className="mb-2 text-3xl font-bold text-gray-900">
                {t('signup_title')}
              </CardTitle>
              <p className="text-base text-gray-700">
                {t('signup_subtitle')}
              </p>
            </CardHeader>
            <CardContent>
              <SignUpForm />
            </CardContent>
          </Card>
          <p className="mt-8 text-center text-sm text-gray-600">
            {t('signup_prompt_signin')}
            {' '}
            <Link href="/sign-in" className="font-medium text-[#FF0083] hover:underline">
              {t('link_signin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
