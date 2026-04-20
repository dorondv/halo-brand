'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { PlatformCard } from '@/components/dashboard/PlatformCard';
import { cn } from '@/libs/cn';

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
    // Ensure server-rendered charts and metrics refetch for the new `platform` query param
    router.refresh();
  };

  return (
    <div
      className={cn(
        'w-full gap-4',
        // Phone: multi-column grid (unchanged feel for small screens)
        'grid auto-rows-fr grid-cols-2 sm:grid-cols-3',
        // Tablet/desktop: single row — cards keep ~7-column grid width; overflow scrolls (no wrap)
        'md:flex md:flex-nowrap md:overflow-x-auto md:overflow-y-visible md:pb-1 md:[-webkit-overflow-scrolling:touch]',
      )}
    >
      {currentPlatformData.map((platform) => {
        const isSelected = selectedPlatform
          ? platform.platform === selectedPlatform
          : platform.platform === 'all';

        return (
          <button
            key={platform.platform}
            type="button"
            onClick={() => handlePlatformClick(platform.platform)}
            className={cn(
              'min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left',
              'w-full',
              // Match previous ~2xl 7-column cell width so card content size stays consistent
              'md:shrink-0 md:w-auto md:min-w-[calc((100%-6rem)/7)]',
            )}
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
