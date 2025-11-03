import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/auth/SignInForm';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/Logo';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
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
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-[#FF0083] to-[#FF3399] p-1">
              <Logo width={140} height={35} className="text-white" />
            </div>
            <span className="bg-gradient-to-r from-[#FF0083] to-[#FF3399] bg-clip-text text-2xl font-bold whitespace-nowrap text-transparent">Halo Brand</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="mx-auto max-w-md">
          <Card className="rounded-lg border-0 bg-white/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="pb-4 text-center">
              <CardTitle className="mb-2 text-3xl font-bold text-gray-900">
                {t('signin_title')}
              </CardTitle>
              <p className="text-base text-gray-700">
                {t('signin_subtitle')}
              </p>
            </CardHeader>
            <CardContent>
              <SignInForm />
            </CardContent>
          </Card>
          <p className="mt-8 text-center text-sm text-gray-600">
            {t('signin_prompt_signup')}
            {' '}
            <Link href="/sign-up" className="font-medium text-[#FF0083] hover:underline">
              {t('link_signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
