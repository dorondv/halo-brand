'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PlatformCard } from '@/components/dashboard/PlatformCard';

type Platform = {
  platform: string;
  followers: number;
  change: number;
};

type DashboardClientProps = {
  platformData: Platform[];
  selectedPlatform: string | null;
};

function PlatformCardsContent({ platformData, selectedPlatform }: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('DashboardPage');

  const handlePlatformClick = (platform: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (platform === 'all' || !platform) {
      params.delete('platform');
    } else {
      params.set('platform', platform);
    }
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url, { scroll: false });
    router.refresh();
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      {platformData.map((platform) => {
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
              followers={platform.followers}
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

export function PlatformCards({ platformData, selectedPlatform }: DashboardClientProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlatformCardsContent platformData={platformData} selectedPlatform={selectedPlatform} />
    </Suspense>
  );
}
