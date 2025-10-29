import {
  Eye,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import FollowersTrendChart from '@/components/dashboard/FollowersTrendChart';
import ImpressionsAreaChart from '@/components/dashboard/ImpressionsAreaChart';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/libs/Supabase';

export default async function Dashboard() {
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations('DashboardPage');

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="w-full space-y-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-5xl font-bold text-transparent">
              {t('title')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <DateRangePicker />
            <SignOutButton />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title={t('metric_total_followers')}
            value="15,000"
            change={12.5}
            icon={Users}
          />
          <MetricCard
            title={t('metric_total_impressions')}
            value="225,000"
            change={18.7}
            icon={Eye}
          />
          <MetricCard
            title={t('metric_total_engagement')}
            value="11,250"
            change={9.3}
            icon={TrendingUp}
          />
          <MetricCard
            title={t('metric_total_posts')}
            value="30"
            change={5.1}
            icon={FileText}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border border-gray-200 bg-white/80 shadow-lg backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Users className="h-5 w-5 text-pink-500" />
                {t('chart_followers_trend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FollowersTrendChart />
            </CardContent>
          </Card>
          <Card className="border border-gray-200 bg-white/80 shadow-lg backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Eye className="h-5 w-5 text-pink-500" />
                {t('chart_impressions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ImpressionsAreaChart />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
