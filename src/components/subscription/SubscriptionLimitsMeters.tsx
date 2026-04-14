'use client';

import { Building2, ImageIcon, MessageCircle, Share2, Wand2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/libs/cn';

export type SubscriptionLimitsVariant = 'full' | 'connections' | 'calendar' | 'topbar';

type LimitsPayload = {
  limits: {
    maxPostsPerMonth: number;
    maxAIGenerationsPerMonth: number;
    maxImageGenerationsPerMonth: number;
    maxBrands: number;
    maxSocialAccounts: number;
    planType: string;
  };
  usage: {
    postsThisMonth: number;
    aiGenerationsThisMonth: number;
    aiImageGenerationsThisMonth: number;
    brandsCount: number;
    socialAccountsCount: number;
  };
};

type MeterDef = {
  key: string;
  label: string;
  used: number;
  max: number;
  icon: typeof MessageCircle;
};

/** Icon well matches `PlatformCard` / dashboard pink accent. */
function accentForKey(_key: string, atLimit: boolean): { wrap: string; icon: string } {
  if (atLimit) {
    return { wrap: 'bg-red-100 dark:bg-red-950/50', icon: 'text-red-600 dark:text-red-400' };
  }
  return { wrap: 'bg-pink-100 dark:bg-pink-900/40', icon: 'text-pink-600 dark:text-pink-400' };
}

function MeterCard({
  def,
  atLimit,
  compact,
  upgradeLabel,
  isRTL,
}: {
  def: MeterDef;
  atLimit: boolean;
  compact: boolean;
  upgradeLabel: string;
  isRTL: boolean;
}) {
  const displayMax = def.max >= 999999 ? '∞' : def.max;
  const pct
    = def.max >= 999999 ? 0 : Math.min(100, (def.used / Math.max(def.max, 1)) * 100);
  const Icon = def.icon;
  const accent = accentForKey(def.key, atLimit);

  return (
    <Card
      className={cn(
        'shadow-md transition-[box-shadow,border-color] duration-200 ease-out',
        atLimit
          ? '!border-red-300 bg-red-50/80 ring-2 ring-red-100 dark:!border-red-800 dark:bg-red-950/30 dark:ring-red-900/40'
          : 'border-gray-200 dark:border-gray-700',
      )}
    >
      <CardContent className={cn(compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5')}>
        <div className={cn('flex items-start justify-between gap-2', isRTL && 'flex-row-reverse')}>
          <div className={cn('min-w-0 flex-1', isRTL ? 'text-right' : 'text-left')}>
            <p
              className={cn(
                'font-medium text-gray-700 dark:text-gray-200',
                compact ? 'text-xs sm:text-sm' : 'text-sm',
              )}
            >
              {def.label}
            </p>
            <p
              className={cn(
                'font-bold tabular-nums text-gray-900 dark:text-gray-100',
                compact ? 'text-lg sm:text-xl' : 'text-2xl',
              )}
            >
              {def.used}
              <span className="text-base font-normal text-gray-400 dark:text-gray-500">
                {' '}
                /
                {' '}
                {displayMax}
              </span>
            </p>
            {atLimit && (
              <Link
                href="/pricing"
                className="mt-1 block text-xs font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
              >
                {upgradeLabel}
              </Link>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11',
              accent.wrap,
            )}
          >
            <Icon className={cn('h-5 w-5', accent.icon)} />
          </div>
        </div>
        {def.max < 999999 && (
          <div
            className={cn(
              'mt-3 flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
              isRTL && 'justify-end',
            )}
            aria-hidden
          >
            <div
              className={cn(
                'h-full min-w-0 rounded-full transition-all duration-300 ease-out',
                atLimit ? 'bg-red-500 dark:bg-red-500' : 'bg-pink-500 dark:bg-pink-500',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopbarMeterChip({
  def,
  atLimit,
  upgradeLabel,
  isRTL,
}: {
  def: MeterDef;
  atLimit: boolean;
  upgradeLabel: string;
  isRTL: boolean;
}) {
  const displayMax = def.max >= 999999 ? '∞' : def.max;
  const pct
    = def.max >= 999999 ? 0 : Math.min(100, (def.used / Math.max(def.max, 1)) * 100);
  const Icon = def.icon;
  const accent = accentForKey(def.key, atLimit);

  return (
    <div
      className={cn(
        'flex min-w-[10rem] max-w-[13.5rem] shrink-0 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition-[box-shadow,border-color] duration-200 sm:min-w-[10.5rem] dark:border-gray-700 dark:bg-gray-800',
        atLimit
        && '!border-red-300 bg-red-50/90 ring-2 ring-red-100 dark:!border-red-800 dark:bg-red-950/30 dark:ring-red-900/40',
      )}
    >
      <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9',
            accent.wrap,
          )}
        >
          <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', accent.icon)} />
        </div>
        <div className={cn('min-w-0 flex-1', isRTL ? 'text-right' : 'text-left')}>
          <p className="truncate text-xs leading-snug font-medium text-gray-700 dark:text-gray-200">
            {def.label}
          </p>
          <p className="text-sm font-bold text-gray-900 tabular-nums sm:text-base dark:text-gray-100">
            {def.used}
            <span className="text-sm font-normal text-gray-400 sm:text-base dark:text-gray-500">
              /
              {displayMax}
            </span>
          </p>
        </div>
      </div>
      {def.max < 999999 && (
        <div
          className={cn(
            'mt-2 flex h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
            isRTL && 'justify-end',
          )}
          aria-hidden
        >
          <div
            className={cn(
              'h-full min-w-0 rounded-full transition-all duration-300 ease-out',
              atLimit ? 'bg-red-500 dark:bg-red-500' : 'bg-pink-500 dark:bg-pink-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {atLimit && (
        <Link
          href="/pricing"
          className="mt-1 block truncate text-xs leading-tight font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
        >
          {upgradeLabel}
        </Link>
      )}
    </div>
  );
}

type Props = {
  variant?: SubscriptionLimitsVariant;
  brandId?: string | null;
  className?: string;
};

export function SubscriptionLimitsMeters({ variant = 'full', brandId, className }: Props) {
  const t = useTranslations('SubscriptionLimits');
  const tCreate = useTranslations('CreatePost');
  const tPricing = useTranslations('Pricing');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [data, setData] = useState<LimitsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const gridClass = useMemo(() => {
    if (variant === 'connections') {
      return 'grid gap-4 sm:grid-cols-2';
    }
    if (variant === 'calendar') {
      return 'grid gap-3 sm:grid-cols-3';
    }
    if (variant === 'topbar') {
      return 'flex gap-3 overflow-x-auto pb-1';
    }
    return 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
  }, [variant]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const url = brandId
          ? `/api/subscriptions/limits?brandId=${encodeURIComponent(brandId)}`
          : '/api/subscriptions/limits';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          return;
        }
        const json = await res.json();
        if (!cancelled && json.limits && json.usage) {
          setData({ limits: json.limits, usage: json.usage });
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const meters = useMemo((): MeterDef[] => {
    if (!data) {
      return [];
    }
    const { limits, usage } = data;
    if (variant === 'connections') {
      return [
        {
          key: 'brands',
          label: t('brands_label'),
          used: usage.brandsCount,
          max: limits.maxBrands,
          icon: Building2,
        },
        {
          key: 'social',
          label: t('social_label'),
          used: usage.socialAccountsCount,
          max: limits.maxSocialAccounts,
          icon: Share2,
        },
      ];
    }
    if (variant === 'calendar') {
      return [
        {
          key: 'posts',
          label: tCreate('posts_this_month'),
          used: usage.postsThisMonth,
          max: limits.maxPostsPerMonth,
          icon: MessageCircle,
        },
        {
          key: 'ai',
          label: tCreate('ai_content_this_month'),
          used: usage.aiGenerationsThisMonth,
          max: limits.maxAIGenerationsPerMonth,
          icon: Wand2,
        },
        {
          key: 'aiImg',
          label: tCreate('ai_images_this_month'),
          used: usage.aiImageGenerationsThisMonth,
          max: limits.maxImageGenerationsPerMonth,
          icon: ImageIcon,
        },
      ];
    }
    // full + topbar (same metrics as pricing / create-post)
    return [
      {
        key: 'posts',
        label: tCreate('posts_this_month'),
        used: usage.postsThisMonth,
        max: limits.maxPostsPerMonth,
        icon: MessageCircle,
      },
      {
        key: 'ai',
        label: tCreate('ai_content_this_month'),
        used: usage.aiGenerationsThisMonth,
        max: limits.maxAIGenerationsPerMonth,
        icon: Wand2,
      },
      {
        key: 'aiImg',
        label: tCreate('ai_images_this_month'),
        used: usage.aiImageGenerationsThisMonth,
        max: limits.maxImageGenerationsPerMonth,
        icon: ImageIcon,
      },
      {
        key: 'brands',
        label: t('brands_label'),
        used: usage.brandsCount,
        max: limits.maxBrands,
        icon: Building2,
      },
      {
        key: 'social',
        label: t('social_label'),
        used: usage.socialAccountsCount,
        max: limits.maxSocialAccounts,
        icon: Share2,
      },
    ];
  }, [data, variant, t, tCreate]);

  const compact = variant === 'calendar';

  if (loading) {
    if (variant === 'topbar') {
      return (
        <div
          className={cn(
            'w-full border-t border-gray-200 bg-gray-50/95 dark:border-gray-800 dark:bg-gray-950/80',
            className,
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="mx-3 mt-3 h-4 w-56 max-w-full animate-pulse rounded-md bg-gray-200 dark:bg-gray-600" />
          <div className="flex gap-3 overflow-hidden px-3 py-3 sm:px-5">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-[4.5rem] min-w-[10rem] shrink-0 animate-pulse rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
              />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div
        className={cn(
          'rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800',
          className,
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="h-5 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
        <div className={cn('mt-4', gridClass)}>
          {(variant === 'connections' ? [1, 2] : variant === 'calendar' ? [1, 2, 3] : [1, 2, 3, 4, 5]).map(i => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data || meters.length === 0) {
    return null;
  }

  const upgradeLabel = tCreate('upgrade_plan');
  const planType = data.limits.planType;
  const planName
    = planType === 'free'
      ? t('plan_free')
      : planType === 'basic'
        ? tPricing('plan_basic.name')
        : planType === 'pro'
          ? tPricing('plan_pro.name')
          : planType === 'business'
            ? tPricing('plan_business.name')
            : planType;

  const currentPlanLine = t.rich('current_plan', {
    plan: planName,
    accent: chunks => (
      <span className="font-semibold text-pink-600 dark:text-pink-400">{chunks}</span>
    ),
  });

  if (variant === 'topbar') {
    return (
      <div
        className={cn(
          'w-full border-t border-gray-200 bg-gray-50/95 dark:border-gray-800 dark:bg-gray-950/80',
          className,
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className={cn('flex flex-col gap-2 px-3 py-3 sm:px-5 sm:py-3.5')}>
          <div
            className={cn(
              'flex w-full min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1',
            )}
          >
            <span className="shrink-0 text-sm font-semibold text-gray-900 sm:text-base dark:text-white">
              {t('usage_title')}
            </span>
            <span className="min-w-0 truncate text-xs text-gray-600 sm:text-sm dark:text-gray-400">
              {currentPlanLine}
            </span>
          </div>
          {data.limits.planType === 'free' && (
            <p className="max-w-full text-xs leading-snug text-gray-500 sm:text-sm dark:text-gray-400">{t('free_tier_note')}</p>
          )}
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
            {meters.map((def) => {
              const atLimit = def.used >= def.max && def.max < 999999;
              return (
                <TopbarMeterChip
                  key={def.key}
                  def={def}
                  atLimit={atLimit}
                  upgradeLabel={upgradeLabel}
                  isRTL={isRTL}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={className} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={cn('mb-3 space-y-1', isRTL && 'text-right')}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('usage_title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {currentPlanLine}
        </p>
        {data.limits.planType === 'free' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('free_tier_note')}
          </p>
        )}
      </div>
      <div className={gridClass}>
        {meters.map((def) => {
          const atLimit = def.used >= def.max && def.max < 999999;
          return (
            <MeterCard
              key={def.key}
              def={def}
              atLimit={atLimit}
              compact={compact}
              upgradeLabel={upgradeLabel}
              isRTL={isRTL}
            />
          );
        })}
      </div>
    </section>
  );
}
