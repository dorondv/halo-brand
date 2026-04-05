'use client';

import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Admin');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

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
      toast.showToast(t('failed_load_payments'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const handleRefund = async () => {
    if (!selectedPayment || isProcessingRefund) {
      return;
    }

    const amount = refundAmount ? Number.parseFloat(refundAmount) : selectedPayment.amount;
    if (amount <= 0 || amount > selectedPayment.amount) {
      toast.error(t('invalid_refund_amount'));
      return;
    }

    // Check if refund exceeds remaining amount
    const remainingAmount = selectedPayment.refundedAmount
      ? selectedPayment.amount - selectedPayment.refundedAmount
      : selectedPayment.amount;
    if (amount > remainingAmount) {
      toast.error(`Refund amount cannot exceed remaining amount of $${remainingAmount.toFixed(2)}`);
      return;
    }

    try {
      setIsProcessingRefund(true);
      const response = await fetch(`/api/admin/payments/${selectedPayment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: refundReason }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process refund');
      }

      toast.success(`Refund of $${amount.toFixed(2)} processed successfully`);
      setShowRefundModal(false);
      setSelectedPayment(null);
      setRefundAmount('');
      setRefundReason('');
      fetchPayments();
    } catch (error: any) {
      console.error('Error processing refund:', error);
      toast.error(error.message || t('failed_process_refund'));
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const canRefund = (payment: Payment) => {
    return (
      payment.status === 'paid'
      && payment.paypalSaleId
      && (!payment.refundedAmount || payment.refundedAmount < payment.amount)
    );
  };

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('payments_title')}</h1>
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
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Actions
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
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    {canRefund(payment) && (
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setRefundAmount('');
                          setRefundReason('');
                          setShowRefundModal(true);
                        }}
                        className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                        title={t('refund')}
                      >
                        <RotateCcw className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && selectedPayment && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
              {t('process_refund')}
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              User:
              {' '}
              <strong>{selectedPayment.subscription.user.email}</strong>
              <br />
              Original Amount:
              {' '}
              <strong>
                $
                {selectedPayment.amount.toFixed(2)}
              </strong>
              {selectedPayment.refundedAmount && (
                <>
                  <br />
                  Already Refunded:
                  {' '}
                  <strong>
                    $
                    {selectedPayment.refundedAmount.toFixed(2)}
                  </strong>
                  <br />
                  Remaining:
                  {' '}
                  <strong>
                    $
                    {(selectedPayment.amount - selectedPayment.refundedAmount).toFixed(2)}
                  </strong>
                </>
              )}
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="refund-amount" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Refund Amount *
                </label>
                <input
                  id="refund-amount"
                  type="number"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder={
                    selectedPayment.refundedAmount
                      ? `Max: ${(selectedPayment.amount - selectedPayment.refundedAmount).toFixed(2)}`
                      : selectedPayment.amount.toFixed(2)
                  }
                  min="0.01"
                  max={
                    selectedPayment.refundedAmount
                      ? selectedPayment.amount - selectedPayment.refundedAmount
                      : selectedPayment.amount
                  }
                  step="0.01"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty for full refund
                </p>
              </div>

              <div>
                <label htmlFor="refund-reason" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason (optional)
                </label>
                <textarea
                  id="refund-reason"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder={t('refund_reason_placeholder')}
                />
              </div>

              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-300">
                    Refunds must be processed within 180 days of payment. After that, use PayPal
                    dashboard.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedPayment(null);
                  setRefundAmount('');
                  setRefundReason('');
                }}
                disabled={isProcessingRefund}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={isProcessingRefund}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessingRefund
                  ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    )
                  : (
                      t('process_refund')
                    )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
