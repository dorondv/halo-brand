'use client';

import { DollarSign, Download, Eye, Filter, ShoppingCart, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type MarketingMetrics = {
  pageviews: number;
  signupStarts: number;
  signupCompletes: number;
  leadSubmits: number;
  purchases: number;
  conversionRate: number;
  signupRate: number;
  totalRevenue: number;
};

type BreakdownItem = {
  [key: string]: string | number;
  pageviews: number;
  signupStarts: number;
  signupCompletes: number;
  leadSubmits: number;
  purchases: number;
  totalRevenue: number;
  conversionRate: number;
};

export function AdminMarketingAnalytics() {
  const toast = useToast();
  const [metrics, setMetrics] = useState<MarketingMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'utmSource' | 'utmCampaign' | 'country'>('utmSource');

  // Filters
  const [utmSource, setUtmSource] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (utmSource) {
        params.append('utmSource', utmSource);
      }
      if (utmCampaign) {
        params.append('utmCampaign', utmCampaign);
      }
      if (country) {
        params.append('country', country);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const [metricsRes, breakdownRes, usersRes] = await Promise.all([
        fetch(`/api/admin/marketing/analytics?${params.toString()}`),
        fetch(`/api/admin/marketing/breakdown?groupBy=${groupBy}`),
        fetch('/api/admin/marketing/users'),
      ]);

      if (!metricsRes.ok || !breakdownRes.ok || !usersRes.ok) {
        throw new Error('Failed to load data');
      }

      const [metricsData, breakdownData, usersData] = await Promise.all([
        metricsRes.json(),
        breakdownRes.json(),
        usersRes.json(),
      ]);

      setMetrics(metricsData.metrics);
      setBreakdown(breakdownData);
      setUsers(usersData);
    } catch (error: any) {
      console.error('Error fetching marketing analytics:', error);
      toast.error('Failed to load marketing analytics');
    } finally {
      setLoading(false);
    }
  }, [utmSource, utmCampaign, country, startDate, endDate, groupBy, toast]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/marketing/export');
      if (!response.ok) {
        throw new Error('Failed to export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marketing-users-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export started');
    } catch (error: any) {
      console.error('Error exporting:', error);
      toast.error('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
      </div>
    );
  }

  const metricCards = [
    {
      title: 'Pageviews',
      value: metrics?.pageviews || 0,
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Signups',
      value: metrics?.signupCompletes || 0,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      subtitle: `${metrics?.signupRate.toFixed(1) || 0}% conversion`,
    },
    {
      title: 'Purchases',
      value: metrics?.purchases || 0,
      icon: ShoppingCart,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      subtitle: `${metrics?.conversionRate.toFixed(1) || 0}% conversion`,
    },
    {
      title: 'Total Revenue',
      value: `$${(metrics?.totalRevenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track UTM parameters, geo data, and conversion metrics
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-white hover:bg-pink-700"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Filters</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <input
            type="text"
            placeholder="UTM Source"
            value={utmSource}
            onChange={e => setUtmSource(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="text"
            placeholder="UTM Campaign"
            value={utmCampaign}
            onChange={e => setUtmCampaign(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="text"
            placeholder="Country"
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            placeholder="Start Date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            placeholder="End Date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`rounded-lg border border-gray-200 p-6 dark:border-gray-700 ${card.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
                  <p className={`mt-2 text-2xl font-bold ${card.color}`}>{card.value}</p>
                  {card.subtitle && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.subtitle}</p>
                  )}
                </div>
                <Icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Breakdown Table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Breakdown</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setGroupBy('utmSource')}
                className={`rounded px-3 py-1 text-sm ${
                  groupBy === 'utmSource'
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                By Source
              </button>
              <button
                onClick={() => setGroupBy('utmCampaign')}
                className={`rounded px-3 py-1 text-sm ${
                  groupBy === 'utmCampaign'
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                By Campaign
              </button>
              <button
                onClick={() => setGroupBy('country')}
                className={`rounded px-3 py-1 text-sm ${
                  groupBy === 'country'
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                By Country
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  {groupBy === 'utmSource' ? 'UTM Source' : groupBy === 'utmCampaign' ? 'UTM Campaign' : 'Country'}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Pageviews</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Signups</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Purchases</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Revenue</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Conv. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {breakdown.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No data available
                      </td>
                    </tr>
                  )
                : (
                    breakdown.map((item) => {
                      const groupValue = String(item[groupBy] || 'Unknown');
                      return (
                        <tr key={`${groupBy}-${groupValue}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {groupValue}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                            {item.pageviews}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                            {item.signupCompletes}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                            {item.purchases}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                            $
                            {item.totalRevenue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                            {item.conversionRate.toFixed(1)}
                            %
                          </td>
                        </tr>
                      );
                    })
                  )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Registered</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">UTM Source</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Country</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">LTV</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No users found
                      </td>
                    </tr>
                  )
                : (
                    users.slice(0, 50).map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{user.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {user.registrationDate ? new Date(user.registrationDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{user.utmSource || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{user.geoCountry || '-'}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                          $
                          {user.revenueTotal.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{user.userStatus}</td>
                      </tr>
                    ))
                  )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
