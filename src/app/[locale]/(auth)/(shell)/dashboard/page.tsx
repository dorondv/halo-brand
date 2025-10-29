import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/SupabaseServer';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Users, BarChart3, FileText, Eye, TrendingUp } from 'lucide-react';
import FollowersTrendChart from '@/components/dashboard/FollowersTrendChart';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/sign-in');
    const t = await getTranslations('DashboardPage');
    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-gray-50 to-white">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">{t('title')}</h1>
                    </div>
                    <DateRangePicker />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard title={t('metric_total_followers')} value={new Intl.NumberFormat('en-US').format(219712)} change={12.5} icon={Users} />
                    <MetricCard title={t('metric_total_impressions')} value="0" change={15.3} icon={Eye} />
                    <MetricCard title={t('metric_total_engagement')} value="0" change={8.2} icon={BarChart3} />
                    <MetricCard title={t('metric_total_posts')} value="0" change={5.1} icon={FileText} />
                </div>
                <div className="grid grid-cols-1 gap-6">
                    <div className="rounded-lg text-card-foreground col-span-1 bg-white/80 backdrop-blur-xl border border-gray-200 shadow-lg">
                        <div className="p-6">
                            <h3 className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2 text-gray-800">
                                <TrendingUp className="w-5 h-5 text-pink-500" />
                                {t('chart_followers_trend')}
                            </h3>
                        </div>
                        <div className="p-6 pt-0 h-96 w-full">
                            <FollowersTrendChart />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


