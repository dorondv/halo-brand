import { Zap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/auth/SignInForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    redirect('/dashboard');
  }
  const t = await getTranslations('Auth');
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-orange-50">
      <div className="container mx-auto grid items-center gap-12 px-6 py-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <Link href="/" className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-pink-500 to-orange-400 p-2">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <span className="bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-2xl font-bold text-transparent">
              Hello Brand
            </span>
          </Link>
          <h1 className="mb-4 text-5xl leading-tight font-bold">
            {t('signin_title')}
          </h1>
          <p className="max-w-xl text-lg text-gray-600">
            {t('signin_subtitle')}
          </p>
        </div>
        <div className="w-full max-w-md justify-self-center">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-pink-500 to-orange-400 p-2">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <span className="bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-2xl font-bold text-transparent">
                Hello Brand
              </span>
            </Link>
          </div>
          <Card className="border-0 bg-white/80 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-3xl">{t('signin_title')}</CardTitle>
              <CardDescription className="text-base">
                {t('signin_subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInForm />
            </CardContent>
          </Card>
          <p className="mt-8 text-center text-sm text-gray-500">
            {t('signin_prompt_signup')}
            {' '}
            <Link href="/sign-up" className="text-pink-600 hover:underline">
              {t('link_signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
