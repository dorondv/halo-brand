import { Zap } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/auth/SignInForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-2xl font-bold text-gray-900">Hello Brand</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-orange-400">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="bg-white">
        <div className="container mx-auto px-6 py-12">
          <div className="mx-auto max-w-md">
            <Card className="rounded-lg border border-gray-200 bg-white shadow-md">
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
              <Link href="/sign-up" className="font-medium text-pink-600 hover:underline">
                {t('link_signup')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
