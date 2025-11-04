'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { PlatformCard } from '@/components/dashboard/PlatformCard';

type Platform = {
  platform: string;
  value: number;
  change: number;
  metric: string;
};

type MetricType = 'followers' | 'impressions' | 'engagement' | 'posts';

type PlatformWithMetrics = {
  platform: string;
  metrics: Record<MetricType, { value: number; change: number }>;
};

type DashboardClientProps = {
  platformData: Platform[];
  platformDataWithAllMetrics: PlatformWithMetrics[];
  allPlatformMetrics: Record<MetricType, { value: number; change: number }>;
  selectedPlatform: string | null;
  selectedMetric: string;
  isRTL: boolean;
};

function PlatformCardsContent({
  platformDataWithAllMetrics,
  allPlatformMetrics,
  selectedPlatform,
  selectedMetric,
  isRTL,
}: Omit<DashboardClientProps, 'platformData' | 'selectedMetric'> & { selectedMetric: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('DashboardPage');

  // Use pre-calculated metrics for instant switching - no server round-trip needed
  const currentPlatformData = useMemo(() => {
    const metric = selectedMetric as MetricType;
    const platformCards = platformDataWithAllMetrics.map(({ platform, metrics }) => ({
      platform,
      value: metrics[metric].value,
      change: metrics[metric].change,
      metric,
    }));

    const allCard = {
      platform: 'all',
      value: allPlatformMetrics[metric].value,
      change: 0,
      metric,
    };

    // Build base array: "All" first for both, but platforms reversed for RTL
    return isRTL
      ? [allCard, ...[...platformCards].reverse()]
      : [allCard, ...platformCards];
  }, [platformDataWithAllMetrics, allPlatformMetrics, selectedMetric, isRTL]);

  const handlePlatformClick = (platform: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (platform === 'all' || !platform) {
      params.delete('platform');
    } else {
      params.set('platform', platform);
    }
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(url, { scroll: false });
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      {currentPlatformData.map((platform) => {
        const isSelected = selectedPlatform
          ? platform.platform === selectedPlatform
          : platform.platform === 'all';

        return (
          <button
            key={platform.platform}
            type="button"
            onClick={() => handlePlatformClick(platform.platform)}
            className="w-full cursor-pointer text-left transition-transform hover:scale-105"
          >
            <PlatformCard
              platform={platform.platform}
              value={platform.value}
              change={platform.change}
              isSelected={isSelected}
              displayName={platform.platform === 'all' ? t('all_platforms') : undefined}
            />
          </button>
        );
      })}
    </div>
  );
}

export function PlatformCards({
  platformData: _platformData,
  platformDataWithAllMetrics,
  allPlatformMetrics,
  selectedPlatform,
  selectedMetric,
  isRTL,
}: DashboardClientProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlatformCardsContent
        platformDataWithAllMetrics={platformDataWithAllMetrics}
        allPlatformMetrics={allPlatformMetrics}
        selectedPlatform={selectedPlatform}
        selectedMetric={selectedMetric}
        isRTL={isRTL}
      />
    </Suspense>
  );
}
