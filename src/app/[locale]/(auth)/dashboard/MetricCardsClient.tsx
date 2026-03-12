'use client';

import { Eye, FileText, Heart, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';

type MetricType = 'followers' | 'impressions' | 'engagement' | 'posts';

type MetricCardsClientProps = {
  followers: string;
  impressions: string;
  engagement: string;
  posts: string;
  followersChange: number;
  impressionsChange: number;
  engagementChange: number;
  postsChange: number;
  vsLabel: string;
};

export function MetricCardsClient({
  followers,
  impressions,
  engagement,
  posts,
  followersChange,
  impressionsChange,
  engagementChange,
  postsChange,
  vsLabel,
}: MetricCardsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('DashboardPage');
  const selectedMetric = (searchParams.get('metric') || 'followers') as MetricType;

  const handleMetricClick = (metric: MetricType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (metric === 'followers') {
      params.delete('metric');
    } else {
      params.set('metric', metric);
    }
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  };

  return (
    <div className="grid w-full auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
      <button
        type="button"
        onClick={() => handleMetricClick('followers')}
        className="w-full text-left"
      >
        <MetricCard
          title={t('metric_total_followers')}
          value={followers}
          change={followersChange}
          icon={Users}
          vsLabel={vsLabel}
          isSelected={selectedMetric === 'followers'}
        />
      </button>
      <button
        type="button"
        onClick={() => handleMetricClick('impressions')}
        className="w-full text-left"
      >
        <MetricCard
          title={t('metric_total_impressions')}
          value={impressions}
          change={impressionsChange}
          icon={Eye}
          vsLabel={vsLabel}
          isSelected={selectedMetric === 'impressions'}
        />
      </button>
      <button
        type="button"
        onClick={() => handleMetricClick('engagement')}
        className="w-full text-left"
      >
        <MetricCard
          title={t('metric_total_engagement')}
          value={engagement}
          change={engagementChange}
          icon={Heart}
          vsLabel={vsLabel}
          isSelected={selectedMetric === 'engagement'}
        />
      </button>
      <button
        type="button"
        onClick={() => handleMetricClick('posts')}
        className="w-full text-left"
      >
        <MetricCard
          title={t('metric_total_posts')}
          value={posts}
          change={postsChange}
          icon={FileText}
          vsLabel={vsLabel}
          isSelected={selectedMetric === 'posts'}
        />
      </button>
    </div>
  );
}
