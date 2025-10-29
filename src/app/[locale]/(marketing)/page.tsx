import { Calendar, Check, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/libs/cn';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function MarketingPage() {
  const t = await getTranslations('Marketing');
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const features = [
    {
      icon: Calendar,
      title: t('feature_content_title'),
      description: t('feature_content_desc'),
    },
    {
      icon: TrendingUp,
      title: t('feature_analytics_title'),
      description: t('feature_analytics_desc'),
    },
    {
      icon: Users,
      title: t('feature_brands_title'),
      description: t('feature_brands_desc'),
    },
    {
      icon: Sparkles,
      title: t('feature_ai_title'),
      description: t('feature_ai_desc'),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-orange-50">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-pink-500 to-orange-400 p-2">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <span className="bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-2xl font-bold text-transparent">
              Hello Brand
            </span>
          </div>
          {session
            ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {t('greeting', { email: session.user.email ?? '' })}
                  </span>
                  <Link
                    href="/dashboard"
                    className={cn(buttonVariants({}), 'h-auto px-4 py-2')}
                  >
                    {t('go_to_dashboard')}
                  </Link>
                </div>
              )
            : (
                <Link
                  href="/sign-in"
                  className={cn(buttonVariants({ variant: 'ghost' }), 'h-auto px-0 text-gray-600 hover:text-pink-600')}
                >
                  {t('already_registered')}
                </Link>
              )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left Side - Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl leading-tight font-bold lg:text-6xl">
                {t('hero_line1')}
                <br />
                <span className="bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-transparent">
                  {t('hero_line2_highlight')}
                </span>
                <br />
                {t('hero_line3')}
              </h1>
              <p className="text-xl text-gray-600">
                {t('hero_subtitle')}
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(feature => (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 rounded-xl border border-pink-100 bg-white/50 p-4"
                >
                  <div className="rounded-lg bg-pink-100 p-2">
                    <feature.icon className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-8 pt-4">
              <div>
                <div className="text-3xl font-bold text-gray-800">1000+</div>
                <div className="text-sm text-gray-600">{t('stat_active_users')}</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-800">50K+</div>
                <div className="text-sm text-gray-600">{t('stat_managed_posts')}</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-800">98%</div>
                <div className="text-sm text-gray-600">{t('stat_satisfaction')}</div>
              </div>
            </div>
          </div>

          {/* Right Side - Sign Up Form */}
          <div>
            {!session && (
              <Card className="border-0 bg-white/80 shadow-2xl backdrop-blur-xl">
                <CardHeader className="space-y-2 text-center">
                  <CardTitle className="text-3xl">{t('signup_title')}</CardTitle>
                  <CardDescription className="text-base">
                    {t('signup_subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SignUpForm />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="container mx-auto px-6 py-12">
        <div className="rounded-3xl bg-gradient-to-br from-pink-500 to-orange-400 p-12 text-white">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-4xl font-bold">{t('benefits_title')}</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Check className="mx-auto h-8 w-8" />
                <h3 className="text-lg font-semibold">{t('benefit_free_title')}</h3>
                <p className="text-pink-100">{t('benefit_free_desc')}</p>
              </div>
              <div className="space-y-2">
                <Check className="mx-auto h-8 w-8" />
                <h3 className="text-lg font-semibold">{t('benefit_easy_title')}</h3>
                <p className="text-pink-100">{t('benefit_easy_desc')}</p>
              </div>
              <div className="space-y-2">
                <Check className="mx-auto h-8 w-8" />
                <h3 className="text-lg font-semibold">{t('benefit_support_title')}</h3>
                <p className="text-pink-100">{t('benefit_support_desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 text-center text-gray-600">
        <p>{t('footer_copyright')}</p>
      </footer>
    </div>
  );
}
