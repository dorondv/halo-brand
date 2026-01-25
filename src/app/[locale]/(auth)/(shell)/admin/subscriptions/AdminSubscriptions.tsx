'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Subscription = {
  id: string;
  userId: string;
  planType: string;
  status: string;
  paypalSubscriptionId: string | null;
  paypalPlanId: string | null;
  startDate: string;
  endDate: string | null;
  trialEndDate: string | null;
  price: number;
  currency: string;
  isPayPalTrial?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export function AdminSubscriptions() {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/subscriptions');
      if (!response.ok) {
        throw new Error('Failed to load subscriptions');
      }
      const data = await response.json();
      setSubscriptions(data);
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchSubscriptions();
  }, [fetchSubscriptions]);

  const getStatusBadge = (subscription: Subscription) => {
    const badges: Record<string, { color: string; bg: string; label: string }> = {
      active: {
        color: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        label: 'Active',
      },
      cancelled: {
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        label: 'Cancelled',
      },
      suspended: {
        color: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        label: 'Suspended',
      },
      expired: {
        color: 'text-gray-700 dark:text-gray-400',
        bg: 'bg-gray-100 dark:bg-gray-900/30',
        label: 'Expired',
      },
      trialing: {
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        label: 'Trialing',
      },
      free: {
        color: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        label: 'Free',
      },
    };

    const badge = badges[subscription.status] || {
      color: 'text-gray-700 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-900/30',
      label: subscription.status,
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color} ${badge.bg}`}
      >
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subscriptions</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage user subscriptions and billing
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  PayPal ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {subscriptions.map(subscription => (
                <tr key={subscription.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {subscription.user.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {subscription.user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    <span className="capitalize">{subscription.planType}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(subscription)}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white">
                    $
                    {subscription.price.toFixed(2)}
                    {' '}
                    {subscription.currency}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(subscription.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {subscription.endDate
                      ? new Date(subscription.endDate).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {subscription.paypalSubscriptionId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
