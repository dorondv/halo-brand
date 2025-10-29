import { Zap } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInForm } from '@/components/auth/SignInForm';

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    redirect('/dashboard');
  }
  const t = await getTranslations('Auth');
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-orange-50">
      <div className="container mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12 items-center">
        <div className="hidden lg:block">
          <Link href="/" className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-orange-400 rounded-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-transparent">
              Hello Brand
            </span>
          </Link>
          <h1 className="text-5xl font-bold leading-tight mb-4">
            {t('signin_title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-xl">
            {t('signin_subtitle')}
          </p>
        </div>
        <div className="w-full max-w-md justify-self-center">
          <div className="flex justify-center mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-pink-500 to-orange-400 rounded-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-transparent">
                Hello Brand
              </span>
            </Link>
          </div>
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-xl">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-3xl">{t('signin_title')}</CardTitle>
              <CardDescription className="text-base">
                {t('signin_subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInForm />
            </CardContent>
          </Card>
          <p className="text-center text-sm text-gray-500 mt-8">
            {t('signin_prompt_signup')}{' '}
            <Link href="/sign-up" className="text-pink-600 hover:underline">
              {t('link_signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
