import { ArrowLeft, ArrowRight, Calendar, Check, Sparkles, TrendingUp, Users } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/libs/cn';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function MarketingPage() {
  const t = await getTranslations('Marketing');
  const locale = await getLocale();
  const isRTL = locale === 'he';
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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          {/* Logo - Always first in DOM, appears on start (left in LTR, right in RTL) */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-[#FF0083] to-[#FF3399] p-1">
              <Logo width={140} height={35} className="text-white" />
            </div>
            <span className="bg-gradient-to-r from-[#FF0083] to-[#FF3399] bg-clip-text text-2xl font-bold whitespace-nowrap text-transparent">Halo Brand</span>
          </div>
          {/* Auth Links - Always second in DOM, appears on end (right in LTR, left in RTL) */}
          <div className={cn('flex items-center gap-4', isRTL ? 'flex-row-reverse' : '')}>
            {!session && (
              <>
                <LocaleSwitcher />
                <Link
                  href="/sign-in"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap text-gray-600 transition-colors hover:text-[#FF0083] focus-visible:ring-2 focus-visible:ring-[#FF0083] focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  {t('already_registered')}
                </Link>
              </>
            )}
            {session && (
              <>
                {isRTL
                  ? (
                    // Hebrew RTL: DOM order Dashboard -> Greeting -> LocaleSwitcher
                    // With flex-row-reverse: Visual order LocaleSwitcher (right) -> Greeting -> Dashboard (left)
                      <>
                        <Link
                          href="/dashboard"
                          className={cn(
                            'rounded-lg bg-gradient-to-r from-[#FF0083] to-[#FF3399] px-4 py-2',
                            'text-white font-medium flex items-center gap-2 flex-row-reverse',
                            'hover:from-[#FF0083] hover:to-[#FF0083] transition-all',
                          )}
                        >
                          {t('go_to_dashboard')}
                          <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <span className="text-sm text-gray-600">
                          {t('greeting', { email: session.user.email ?? '' })}
                        </span>
                        <LocaleSwitcher />
                      </>
                    )
                  : (
                    // English LTR: DOM order LocaleSwitcher -> Greeting -> Dashboard
                    // Visual order LocaleSwitcher (left) -> Greeting -> Dashboard button (right)
                      <>
                        <LocaleSwitcher />
                        <span className="text-sm text-gray-600">
                          {t('greeting', { email: session.user.email ?? '' })}
                        </span>
                        <Link
                          href="/dashboard"
                          className={cn(
                            'rounded-lg bg-gradient-to-r from-[#FF0083] to-[#FF3399] px-4 py-2',
                            'text-white font-medium flex items-center gap-2',
                            'hover:from-[#FF0083] hover:to-[#FF0083] transition-all',
                          )}
                        >
                          {t('go_to_dashboard')}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </>
                    )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          {/* Marketing Content - Visual left in LTR, visual right in RTL */}
          <div className={cn('space-y-8', isRTL ? 'text-right' : 'text-left')}>
            <div className="space-y-4">
              <h1 className="text-5xl leading-tight font-bold text-gray-900 lg:text-6xl">
                {t('hero_line1')}
                {' '}
                <span className="bg-gradient-to-r from-[#FF0083] to-[#FF3399] bg-clip-text text-transparent">
                  {t('hero_line2_highlight')}
                </span>
                {' '}
                {t('hero_line3')}
              </h1>
              <p className="text-lg text-gray-700">
                {t('hero_subtitle')}
              </p>
            </div>

            {/* Features Grid - 2x2 */}
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(feature => (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 rounded-xl border border-pink-100 bg-white/50 p-4"
                >
                  <div className="rounded-lg bg-pink-100 p-2">
                    <feature.icon className="h-5 w-5 text-[#FF0083]" />
                  </div>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <h3 className="font-semibold text-gray-800">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Statistics */}
            <div className={`flex items-center gap-8 pt-4 ${isRTL ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
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

          {/* Sign Up Form - Visual right in LTR, visual left in RTL */}
          <div>
            {!session && (
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
            )}
          </div>
        </div>
      </div>

      {/* Benefits Section - Gradient Background */}
      <div className="container mx-auto px-6 py-12">
        <div className="rounded-3xl bg-gradient-to-br from-[#FF0083] to-[#FF3399] p-12 text-white">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-4xl font-bold">
              {t('benefits_title')}
            </h2>
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
