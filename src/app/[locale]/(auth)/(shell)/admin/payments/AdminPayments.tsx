'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Payment = {
  id: string;
  subscriptionId: string;
  invoiceNumber: string;
  paypalTransactionId: string | null;
  paypalSaleId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentDate: string;
  refundedAmount: number | null;
  refundedDate: string | null;
  refundReason: string | null;
  subscription: {
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
};

export function AdminPayments() {
  const toast = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/payments');
      if (!response.ok) {
        throw new Error('Failed to load payments');
      }
      const data = await response.json();
      setPayments(data);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      toast.showToast('Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; bg: string }> = {
      paid: {
        color: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
      },
      pending: {
        color: 'text-yellow-700 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      },
      failed: {
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
      },
      refunded: {
        color: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
      },
      partially_refunded: {
        color: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
      },
    };

    const badge = badges[status] || {
      color: 'text-gray-700 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-900/30',
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color} ${badge.bg}`}
      >
        {status.replace('_', ' ')}
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payments</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and manage payment transactions and refunds
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
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Refunded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  PayPal Transaction
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {payments.map(payment => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {payment.subscription.user.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {payment.subscription.user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {payment.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white">
                    $
                    {payment.amount.toFixed(2)}
                    {' '}
                    {payment.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(payment.status)}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {payment.refundedAmount
                      ? (
                          <div>
                            <div className="text-red-600 dark:text-red-400">
                              $
                              {payment.refundedAmount.toFixed(2)}
                            </div>
                            {payment.refundedDate && (
                              <div className="text-xs text-gray-400">
                                {new Date(payment.refundedDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )
                      : (
                          '—'
                        )}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {payment.paypalTransactionId || '—'}
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
