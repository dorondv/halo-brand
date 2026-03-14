'use client';

import { Loader2, PauseCircle, PlayCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Admin');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      toast.error(t('failed_load_subscriptions'));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    void fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleCancel = async (subscription: Subscription) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Cancel subscription for ${subscription.user.email}?`)) {
      return;
    }

    try {
      setActionLoading(subscription.id);
      const response = await fetch(`/api/admin/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      toast.success(t('subscription_cancelled'));
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast.error(error.message || t('failed_cancel_subscription'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (subscription: Subscription) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Suspend subscription for ${subscription.user.email}?`)) {
      return;
    }

    try {
      setActionLoading(subscription.id);
      const response = await fetch(`/api/admin/subscriptions/${subscription.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Suspended by admin' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to suspend subscription');
      }

      toast.success(t('subscription_suspended'));
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error suspending subscription:', error);
      toast.error(error.message || 'Failed to suspend subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (subscription: Subscription) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Activate subscription for ${subscription.user.email}?`)) {
      return;
    }

    try {
      setActionLoading(subscription.id);
      const response = await fetch(`/api/admin/subscriptions/${subscription.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Activated by admin' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.details || errorData.error || 'Failed to activate subscription';
        const suggestion = errorData.suggestion;

        if (suggestion) {
          toast.error(`${errorMessage}. ${suggestion}`);
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      toast.success('Subscription activated');
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error activating subscription:', error);
      toast.error(error.message || t('failed_activate_subscription'));
    } finally {
      setActionLoading(null);
    }
  };

  const canActivate = (subscription: Subscription) => {
    // Only allow activating suspended subscriptions
    // Cancelled subscriptions cannot be reactivated in PayPal
    return subscription.status === 'suspended';
  };

  const getStatusBadge = (subscription: Subscription) => {
    // Check if it's a PayPal trial period
    if (subscription.isPayPalTrial) {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          Trial Period
        </span>
      );
    }

    const badges: Record<string, { color: string; bg: string; labelKey: string }> = {
      active: { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', labelKey: 'status_active' },
      cancelled: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', labelKey: 'status_cancelled' },
      suspended: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', labelKey: 'status_suspended' },
      expired: { color: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/30', labelKey: 'status_expired' },
      trialing: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', labelKey: 'status_trialing' },
      free: { color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', labelKey: 'status_free' },
    };

    const badge = badges[subscription.status] || {
      color: 'text-gray-700 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-900/30',
      labelKey: null as string | null,
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color} ${badge.bg}`}
      >
        {badge.labelKey ? t(badge.labelKey as 'status_active' | 'status_cancelled' | 'status_suspended' | 'status_expired' | 'status_trialing' | 'status_free') : subscription.status}
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('subscriptions_title')}</h1>
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
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Actions
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
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {subscription.paypalSubscriptionId && (
                        <>
                          {subscription.status === 'active' && (
                            <>
                              <button
                                onClick={() => handleSuspend(subscription)}
                                disabled={actionLoading === subscription.id}
                                className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50 dark:text-yellow-400 dark:hover:text-yellow-300"
                                title={t('suspend')}
                              >
                                {actionLoading === subscription.id
                                  ? (
                                      <Loader2 className="h-5 w-5 animate-spin" />
                                    )
                                  : (
                                      <PauseCircle className="h-5 w-5" />
                                    )}
                              </button>
                              <button
                                onClick={() => handleCancel(subscription)}
                                disabled={actionLoading === subscription.id}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                                title={t('cancel')}
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          {canActivate(subscription) && (
                            <button
                              onClick={() => handleActivate(subscription)}
                              disabled={actionLoading === subscription.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
                              title={`${t('activate')} (${t('activate_hint')})`}
                            >
                              {actionLoading === subscription.id
                                ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  )
                                : (
                                    <PlayCircle className="h-5 w-5" />
                                  )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
