import { ArrowLeft, ArrowRight, Calendar, Check, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          {!session && (
            <Link
              href="/sign-in"
              className="text-gray-900 transition-colors hover:text-pink-600"
            >
              {t('already_registered')}
            </Link>
          )}
          {session && (
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-sm text-gray-600">
                {t('greeting', { email: session.user.email ?? '' })}
              </span>
              <Link
                href="/dashboard"
                className={cn(
                  'rounded-lg bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-2',
                  'text-white font-medium flex items-center gap-2',
                  'hover:from-pink-600 hover:to-orange-500 transition-all',
                  isRTL ? 'flex-row-reverse' : '',
                )}
              >
                {t('go_to_dashboard')}
                {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Link>
            </div>
          )}
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-2xl font-bold text-gray-900">Hello Brand</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-orange-400">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - White Background */}
      <div className="bg-white">
        <div className="container mx-auto px-6 py-12">
          <div className={`grid items-start gap-12 lg:grid-cols-2 ${isRTL ? 'lg:grid-cols-[1fr_1fr]' : ''}`}>
            {/* Left Side - Sign Up Form (RTL: left, LTR: left) */}
            <div className={isRTL ? 'lg:order-2' : ''}>
              {!session && (
                <Card className="rounded-lg border border-gray-200 bg-white shadow-md">
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

            {/* Right Side - Marketing Content (RTL: right, LTR: right) */}
            <div className={`space-y-8 ${isRTL ? 'text-right lg:order-1' : 'text-left'}`}>
              <div className="space-y-4">
                <h1 className="text-5xl leading-tight font-bold text-gray-900 lg:text-6xl">
                  {t('hero_line1')}
                  {' '}
                  <span className="bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-transparent">
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
                  <Card
                    key={feature.title}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-orange-400">
                        <feature.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className={isRTL ? 'text-right' : 'text-left'}>
                        <h3 className="mb-1 font-semibold text-gray-900">{feature.title}</h3>
                        <p className="text-sm text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Statistics */}
              <div className={`flex items-center gap-8 pt-4 ${isRTL ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
                <div>
                  <div className="text-3xl font-bold text-gray-900">98%</div>
                  <div className="text-sm text-gray-600">{t('stat_satisfaction')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900">+50K</div>
                  <div className="text-sm text-gray-600">{t('stat_managed_posts')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900">+1000</div>
                  <div className="text-sm text-gray-600">{t('stat_active_users')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section - Gradient Background */}
      <div className="mt-16 mb-24">
        <div className="mx-6 rounded-2xl bg-gradient-to-r from-pink-500 to-orange-400 py-16">
          <div className={`mx-auto max-w-5xl px-6 ${isRTL ? 'text-right' : 'text-left'}`}>
            <h2 className="mb-12 text-center text-4xl font-bold text-white">
              {t('benefits_title')}
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className={`flex flex-col items-start ${isRTL ? 'items-end' : 'items-start'}`}>
                <div className={`mb-3 flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t('benefit_free_title')}</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/90">{t('benefit_free_desc')}</p>
              </div>
              <div className={`flex flex-col items-start ${isRTL ? 'items-end' : 'items-start'}`}>
                <div className={`mb-3 flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t('benefit_easy_title')}</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/90">{t('benefit_easy_desc')}</p>
              </div>
              <div className={`flex flex-col items-start ${isRTL ? 'items-end' : 'items-start'}`}>
                <div className={`mb-3 flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t('benefit_support_title')}</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/90">{t('benefit_support_desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white pt-8 pb-16 text-center">
        <p className="text-sm text-gray-600">{t('footer_copyright')}</p>
      </footer>
    </div>
  );
}
