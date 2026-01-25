'use client';

import { ArrowLeft, Check, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/libs/cn';

// PayPal types
declare global {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Window {
    paypal?: {
      Buttons: (options: any) => {
        render: (container: string) => void;
      };
    };
  }
}

const planDetails: Record<'basic' | 'pro' | 'business', { priceMonthly: number; priceAnnual: number }> = {
  basic: {
    priceMonthly: 29,
    priceAnnual: 276,
  },
  pro: {
    priceMonthly: 59,
    priceAnnual: 564,
  },
  business: {
    priceMonthly: 99,
    priceAnnual: 948,
  },
};

export function PaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = (searchParams.get('plan') || 'basic') as 'basic' | 'pro' | 'business';
  const billing = searchParams.get('billing') || 'monthly';
  const isAnnual = billing === 'annual';
  const locale = useLocale();
  const isRTL = locale === 'he';
  const t = useTranslations('Payment');
  const toast = useToast();

  const [paypalLoading, setPaypalLoading] = useState(true);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [paypalPlanId, setPaypalPlanId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const planDetail = planDetails[plan];
  const displayPrice = isAnnual ? planDetail.priceAnnual / 12 : planDetail.priceMonthly;
  const planName = t(`plan_${plan}`);
  const billingCycle = isAnnual ? t('billing_cycle_annual') : t('billing_cycle');

  const renderPayPalButtons = () => {
    const container = document.getElementById('paypal-button-container');
    if (!container || !window.paypal || !paypalPlanId) {
      return;
    }

    container.innerHTML = '';

    window.paypal.Buttons({
      style: {
        shape: 'rect',
        color: 'white',
        layout: 'vertical',
        label: 'subscribe',
      },
      createSubscription(_data: any, actions: any) {
        return actions.subscription.create({
          plan_id: paypalPlanId,
        });
      },
      async onApprove(data: any, _actions: any) {
        const subscriptionID = data.subscriptionID || data.subscription_id || data.id;

        try {
          setProcessing(true);

          const response = await fetch('/api/subscriptions/link', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscriptionID,
              planType: plan,
              billingCycle: billing,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to link subscription');
          }

          toast.showToast(t('payment_success'), 'success');

          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } catch (error: any) {
          console.error('Error linking subscription:', error);
          toast.showToast(error.message || t('payment_error'), 'error');
          setProcessing(false);
        }
      },
      onError(err: any) {
        console.error('PayPal error:', err);
        toast.showToast(t('payment_error'), 'error');
        setProcessing(false);
      },
      onCancel() {
        setProcessing(false);
      },
    }).render('#paypal-button-container');
  };

  const loadPayPalSDK = async () => {
    try {
      const response = await fetch(`/api/subscriptions/client-id?plan=${plan}&billing=${billing}`);
      const { clientId, planId } = await response.json();
      setPaypalClientId(clientId);
      if (planId) {
        setPaypalPlanId(planId);
      }

      if (window.paypal) {
        setPaypalLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription&currency=USD`;
      script.async = true;
      script.onload = () => {
        setPaypalLoading(false);
      };
      script.onerror = () => {
        setPaypalLoading(false);
        toast.showToast(t('error_loading_sdk'), 'error');
      };
      document.head.appendChild(script);
    } catch (error: any) {
      console.error('Error loading PayPal:', error);
      setPaypalLoading(false);
      toast.showToast(t('error_loading_paypal'), 'error');
    }
  };

  useEffect(() => {
    void loadPayPalSDK();
  }, [plan, billing]);

  useEffect(() => {
    if (!paypalLoading && paypalClientId && window.paypal && paypalPlanId) {
      renderPayPalButtons();
    }
  }, [paypalLoading, paypalClientId, paypalPlanId]);

  return (
    <div className={cn('min-h-screen p-6', isRTL ? 'rtl' : 'ltr')}>
      <div className="mx-auto max-w-2xl">
        <div className={cn('mb-8', isRTL ? 'text-right' : 'text-left')}>
          <Button
            variant="ghost"
            onClick={() => router.push('/pricing')}
            className={cn('mb-4', isRTL ? 'flex-row-reverse' : '')}
          >
            <ArrowLeft size={16} className={isRTL ? 'rotate-180' : ''} />
            {t('back_to_pricing')}
          </Button>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t('subtitle')}
          </p>
        </div>

        {/* Plan Summary */}
        <Card className="mb-6 p-6">
          <div className={cn('flex items-center mb-6', isRTL ? 'flex-row-reverse space-x-reverse' : 'space-x-3')}>
            <Check size={20} className="text-pink-500" />
            <h3 className={cn('text-lg font-semibold', isRTL ? 'text-right' : 'text-left')}>
              {t('plan_summary')}
            </h3>
          </div>

          <div className={cn('flex items-center justify-between', isRTL ? 'flex-row-reverse' : '')}>
            <div className={cn(isRTL ? 'text-right' : 'text-left')}>
              <div className="mb-1 font-medium text-gray-900 dark:text-white">
                {planName}
              </div>
            </div>
            <div className={cn(isRTL ? 'text-left' : 'text-right')}>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                $
                {displayPrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {billingCycle}
              </div>
            </div>
          </div>
        </Card>

        {/* Secure Payment */}
        <Card className="p-6">
          <div className={cn('flex items-center mb-6', isRTL ? 'flex-row-reverse space-x-reverse' : 'space-x-3')}>
            <Lock size={20} className="text-pink-500" />
            <h3 className={cn('text-lg font-semibold', isRTL ? 'text-right' : 'text-left')}>
              {t('secure_payment')}
            </h3>
          </div>

          <p className={cn('text-gray-600 mb-6', isRTL ? 'text-right' : 'text-left')}>
            {t('payment_instructions')}
          </p>

          {paypalLoading
            ? (
                <div className={cn('flex items-center justify-center py-8', isRTL ? 'text-right' : 'text-left')}>
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-pink-500"></div>
                  <span className={cn('ml-3 text-gray-600', isRTL ? 'mr-3 ml-0' : '')}>
                    {t('loading_payment_options')}
                  </span>
                </div>
              )
            : !paypalClientId
                ? (
                    <div className={cn('text-center py-8', isRTL ? 'text-right' : 'text-left')}>
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                        <p className="mb-2 font-medium text-red-600 dark:text-red-400">
                          {t('paypal_not_configured')}
                        </p>
                        <p className="text-sm text-red-500 dark:text-red-400">
                          {t('paypal_not_configured_desc')}
                        </p>
                      </div>
                    </div>
                  )
                : (
                    <div id="paypal-button-container" className="mb-4"></div>
                  )}

          {processing && (
            <div className={cn('text-center py-4', isRTL ? 'text-right' : 'text-left')}>
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-pink-500"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('processing_payment')}
              </p>
            </div>
          )}

          <div className={cn('text-center text-xs text-gray-500 mt-4', isRTL ? 'text-right' : 'text-left')}>
            {t('powered_by_paypal')}
          </div>
        </Card>

        {/* Footer Note */}
        <div className={cn('text-center text-sm text-gray-500 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl mt-6', isRTL ? 'text-right' : 'text-left')}>
          <p className="mb-1">
            🔒
            {t('security_note')}
          </p>
          <p>{t('cancel_note')}</p>
        </div>
      </div>
    </div>
  );
}
