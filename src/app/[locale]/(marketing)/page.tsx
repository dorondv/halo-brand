import { ArrowRight, Calendar, Sparkles, TrendingUp, Users, Zap, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignUpForm } from '@/components/auth/SignUpForm';
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
            <div className="p-2 bg-gradient-to-br from-pink-500 to-orange-400 rounded-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-orange-500 bg-clip-text text-transparent">
              Hello Brand
            </span>
          </div>
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {t('greeting', { email: session.user.email ?? '' })}
              </span>
              <Button asChild>
                <Link href="/dashboard">{t('go_to_dashboard')}</Link>
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="text-gray-600 hover:text-pink-600"
              asChild
            >
              <Link href="/sign-in">{t('already_registered')}</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
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
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-white/50 rounded-xl border border-pink-100"
                >
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <feature.icon className="w-5 h-5 text-pink-600" />
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
              <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-xl">
                <CardHeader className="text-center space-y-2">
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
        <div className="bg-gradient-to-br from-pink-500 to-orange-400 rounded-3xl p-12 text-white">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-4xl font-bold">{t('benefits_title')}</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="space-y-2">
                <Check className="w-8 h-8 mx-auto" />
                <h3 className="font-semibold text-lg">{t('benefit_free_title')}</h3>
                <p className="text-pink-100">{t('benefit_free_desc')}</p>
              </div>
              <div className="space-y-2">
                <Check className="w-8 h-8 mx-auto" />
                <h3 className="font-semibold text-lg">{t('benefit_easy_title')}</h3>
                <p className="text-pink-100">{t('benefit_easy_desc')}</p>
              </div>
              <div className="space-y-2">
                <Check className="w-8 h-8 mx-auto" />
                <h3 className="font-semibold text-lg">{t('benefit_support_title')}</h3>
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
