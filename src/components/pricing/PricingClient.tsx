'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/libs/cn';

type SubscriptionData = {
  subscription: {
    id: string;
    planType: string;
    status: string;
    paypalSubscriptionId: string | null;
    billingHistory?: Array<{ id: string }>;
  } | null;
};

type PlanConfig = {
  key: 'basic' | 'pro' | 'business';
  priceMonthly: number;
  priceAnnual: number; // Annual price (total for year)
  isPopular?: boolean;
  featureKeys: string[];
};

const planConfigs: PlanConfig[] = [
  {
    key: 'basic',
    priceMonthly: 29,
    priceAnnual: 276, // $23/month when billed annually
    featureKeys: ['brands', 'social_accounts', 'posts_per_month', 'post_scheduling', 'analytics_unlimited', 'events_calendar', 'unified_inbox', 'insights_engine'],
  },
  {
    key: 'pro',
    priceMonthly: 59,
    priceAnnual: 564, // $47/month when billed annually
    isPopular: true,
    featureKeys: ['brands', 'social_accounts', 'posts_per_month', 'post_scheduling', 'analytics_unlimited', 'events_calendar', 'unified_inbox', 'insights_engine', 'pdf_ppt_reports', 'semantic_analysis', 'brand_sentiment', 'preferred_support'],
  },
  {
    key: 'business',
    priceMonthly: 99,
    priceAnnual: 948, // $79/month when billed annually
    featureKeys: ['brands', 'social_accounts', 'posts_per_month', 'post_scheduling', 'analytics_unlimited', 'events_calendar', 'unified_inbox', 'insights_engine', 'pdf_ppt_reports', 'semantic_analysis', 'brand_sentiment', 'preferred_support'],
  },
];

export function PricingClient() {
  const router = useRouter();
  const locale = useLocale();
  const isRTL = locale === 'he';
  const t = useTranslations('Pricing');
  const toast = useToast();

  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(true);

  const loadSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscriptions/status');
      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
      }
    } catch (error: any) {
      console.error('Error loading subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubscriptionStatus();
  }, []);

  const handleChoosePlan = async (planKey: 'basic' | 'pro' | 'business') => {
    // Check if user already has an active subscription
    if (subscriptionData?.subscription) {
      const subscription = subscriptionData.subscription;
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        if (subscription.planType === planKey) {
          toast.showToast(t('already_have_subscription'), 'info');
          return;
        }
        // Allow upgrade/downgrade
      }
    }

    const billingCycle = isAnnual ? 'annual' : 'monthly';
    router.push(`/pricing/payment?plan=${planKey}&billing=${billingCycle}`);
  };

  const getSubscriptionStatusBadge = () => {
    if (!subscriptionData?.subscription) {
      return null;
    }

    const subscription = subscriptionData.subscription;
    const status = subscription.status;

    if (status === 'active' || status === 'trialing') {
      const hasPayments = subscription.billingHistory && subscription.billingHistory.length > 0;
      const badgeText = hasPayments
        ? t('active_subscription')
        : t('trial_period');
      return (
        <Badge variant={hasPayments ? 'default' : 'secondary'} className="mb-4">
          {badgeText}
        </Badge>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className={cn('min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center', isRTL ? 'rtl' : 'ltr')}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900', isRTL ? 'rtl' : 'ltr')}>
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center sm:mb-16"
        >
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:mb-6 sm:text-5xl lg:text-6xl dark:text-white">
            {t('title')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 sm:text-xl dark:text-gray-400">
            {t('subtitle')}
          </p>

          {/* Billing Cycle Toggle */}
          <div className={cn(
            'mt-8 sm:mt-10 flex items-center justify-center gap-4',
            isRTL && 'flex-row-reverse',
          )}
          >
            {isRTL
              ? (
                  // Hebrew RTL: Annual on left (visual right), Monthly on right (visual left)
                  <>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm sm:text-base font-medium transition-colors duration-200',
                        isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
                      )}
                      >
                        {t('annual')}
                      </span>
                      {isAnnual && (
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1 text-xs text-white shadow-md sm:text-sm">
                          {t('save_percent', { percent: '20' })}
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={isAnnual}
                      onCheckedChange={setIsAnnual}
                      isRTL={isRTL}
                    />
                    <span className={cn(
                      'text-sm sm:text-base font-medium transition-colors duration-200',
                      !isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
                    )}
                    >
                      {t('monthly')}
                    </span>
                  </>
                )
              : (
                  // English LTR: Monthly on left, Annual on right
                  <>
                    <span className={cn(
                      'text-sm sm:text-base font-medium transition-colors duration-200',
                      !isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
                    )}
                    >
                      {t('monthly')}
                    </span>
                    <Switch
                      checked={isAnnual}
                      onCheckedChange={setIsAnnual}
                      isRTL={isRTL}
                    />
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm sm:text-base font-medium transition-colors duration-200',
                        isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
                      )}
                      >
                        {t('annual')}
                      </span>
                      {isAnnual && (
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1 text-xs text-white shadow-md sm:text-sm">
                          {t('save_percent', { percent: '20' })}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
          </div>

          {subscriptionData?.subscription && (
            <div className="mt-6 flex justify-center">
              {getSubscriptionStatusBadge()}
            </div>
          )}
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {planConfigs.map((planConfig, index) => {
            const planKey = planConfig.key;

            const isPopular = planConfig.isPopular;
            const currentPlan = subscriptionData?.subscription?.planType === planKey;
            const isActive = subscriptionData?.subscription?.status === 'active'
              || subscriptionData?.subscription?.status === 'trialing';

            return (
              <motion.div
                key={planKey}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card
                  className={cn(
                    'flex flex-col relative transition-all duration-300 hover:shadow-xl',
                    'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
                    'hover:-translate-y-1',
                    isPopular
                      ? 'border-2 border-pink-500 shadow-xl scale-105 md:scale-100 lg:scale-105 ring-2 ring-pink-100 dark:ring-pink-900/20'
                      : 'shadow-md hover:border-pink-200 dark:hover:border-pink-800',
                  )}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-pink-500 to-pink-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg">
                        {t(`plan_${planKey}.popular_badge` as any)}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className={cn('pb-6 pt-8', isRTL ? 'text-right' : 'text-left')}>
                    <CardTitle className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                      {t(`plan_${planKey}.name` as any)}
                    </CardTitle>
                    <p className="text-sm leading-relaxed text-gray-600 sm:text-base dark:text-gray-400">
                      {t(`plan_${planKey}.description` as any)}
                    </p>
                  </CardHeader>

                  <CardContent className="flex flex-grow flex-col px-6 pb-6">
                    {/* Pricing Section */}
                    <div className={cn('mb-8 pb-6 border-b border-gray-200 dark:border-gray-700', isRTL ? 'text-right' : 'text-left')}>
                      {isAnnual
                        ? (
                            <>
                              <div className="mb-2 flex items-baseline gap-2">
                                <div className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">
                                  $
                                  {(planConfig.priceAnnual / 12).toFixed(2)}
                                </div>
                                <div className="text-lg text-gray-400 line-through sm:text-xl dark:text-gray-500">
                                  $
                                  {planConfig.priceMonthly}
                                </div>
                              </div>
                              <div className="mb-1 text-sm text-gray-600 sm:text-base dark:text-gray-400">
                                {t('per_month_annual')}
                              </div>
                              {/* <div className="text-xs sm:text-sm text-pink-600 dark:text-pink-400 font-medium">
                          ${planConfig.priceAnnual} {t('billed_annually')}
                        </div> */}
                            </>
                          )
                        : (
                            <>
                              <div className="mb-1 text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">
                                $
                                {planConfig.priceMonthly}
                              </div>
                              <div className="text-sm text-gray-600 sm:text-base dark:text-gray-400">
                                {t('per_month')}
                              </div>
                            </>
                          )}
                    </div>

                    {/* Features List */}
                    <ul className={cn('space-y-4 mb-8 flex-grow', isRTL ? 'text-right' : 'text-left')}>
                      {planConfig.featureKeys.map((featureKey, idx) => {
                        const featureText = t(`plan_${planKey}.features.${featureKey}` as any);
                        return (
                          <li key={idx} className="group flex items-start gap-3 text-gray-700 dark:text-gray-300">
                            <div className={cn(
                              'flex-shrink-0 mt-0.5 rounded-full bg-green-100 dark:bg-green-900/30 p-1',
                              'group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors',
                              isRTL && 'order-2',
                            )}
                            >
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <span className={cn('flex-1 text-sm sm:text-base leading-relaxed', isRTL && 'text-right')}>
                              {featureText}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {/* CTA Button */}
                    <Button
                      onClick={() => handleChoosePlan(planKey)}
                      disabled={currentPlan && isActive}
                      className={cn(
                        'group mt-auto w-full flex items-center justify-center gap-2',
                        'h-12 sm:h-14 text-base sm:text-lg font-semibold',
                        'bg-gradient-to-r from-pink-500 to-pink-600',
                        'hover:from-pink-600 hover:to-pink-700',
                        'shadow-lg hover:shadow-xl',
                        'transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isPopular && 'ring-2 ring-pink-200 dark:ring-pink-800',
                        currentPlan && isActive && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      {currentPlan && isActive
                        ? (
                            <span className="flex items-center gap-2">
                              <Check size={18} />
                              {t('active_plan')}
                            </span>
                          )
                        : (
                            <>
                              {t('choose_plan')}
                              <ArrowRight size={18} className={cn('transition-transform group-hover:translate-x-1', isRTL && 'rotate-180 group-hover:-translate-x-1')} />
                            </>
                          )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
