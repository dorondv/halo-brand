'use client';

import { CreditCard, DollarSign, Gift, LayoutDashboard, TrendingUp, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { usePathname } from '@/libs/I18nNavigation';

const adminNavPaths = [
  { path: '/admin', key: 'admin_nav_dashboard' as const, icon: LayoutDashboard },
  { path: '/admin/users', key: 'users_title' as const, icon: Users },
  { path: '/admin/subscriptions', key: 'subscriptions_title' as const, icon: CreditCard },
  { path: '/admin/coupons', key: 'coupons_title' as const, icon: Gift },
  { path: '/admin/payments', key: 'payments_title' as const, icon: DollarSign },
  { path: '/admin/marketing', key: 'admin_nav_marketing' as const, icon: TrendingUp },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('Admin');

  return (
    <AdminRoute>
      <div className="flex h-full">
        {/* Admin Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 p-6 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin_panel')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('admin_management')}</p>
          </div>
          <nav className="space-y-2 p-4">
            {adminNavPaths.map((item) => {
              const Icon = item.icon;
              // usePathname from I18nNavigation returns pathname without locale prefix
              const isActive = pathname === item.path
                || (item.path !== '/admin' && pathname?.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`
                    flex items-center gap-3 rounded-lg px-4 py-3 transition-colors
                    ${
                isActive
                  ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Admin Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </AdminRoute>
  );
}
