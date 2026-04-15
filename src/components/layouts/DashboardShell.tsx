'use client';

import {
  Accessibility,
  BarChart3,
  Calendar as CalendarIcon,
  FileText,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquareText,
  PenTool,
  Plug,
  Settings,
  Shield,
  Tags,
  TestTube,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import React, { Suspense } from 'react';
import { AccessibilityModal } from '@/components/accessibility/AccessibilityModal';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { BrandSelector } from '@/components/BrandSelector';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { SubscriptionLimitsMeters } from '@/components/subscription/SubscriptionLimitsMeters';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/Logo';
import { useBrand } from '@/contexts/BrandContext';
import { usePathname } from '@/libs/I18nNavigation';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

type Props = {
  children: React.ReactNode;
  /** Set by server layouts from `process.env.VERCEL_ENV` — client bundles cannot rely on that env reliably. */
  showGetlateTestNav: boolean;
};

const coreNav = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/inbox', key: 'inbox', icon: Mail },
  { href: '/create-post', key: 'create_post', icon: PenTool },
  { href: '/calendar', key: 'calendar', icon: CalendarIcon },
  { href: '/insights', key: 'insights', icon: BarChart3 },
  { href: '/brand-sentiment', key: 'brand_sentiment', icon: TrendingUp },
  { href: '/post-sentiment', key: 'post_sentiment', icon: MessageSquareText },
  { href: '/reports', key: 'reports', icon: FileText },
  { href: '/connections', key: 'integrations', icon: Plug },
  { href: '/settings', key: 'settings', icon: Settings },
  { href: '/pricing', key: 'pricing', icon: Tags },
] as const;

export function DashboardShell({ children, showGetlateTestNav }: Props) {
  const navItems = React.useMemo(
    () => [
      ...coreNav,
      ...(showGetlateTestNav
        ? [{ href: '/getlate-test', key: 'getlate_test' as const, icon: TestTube }]
        : []),
    ],
    [showGetlateTestNav],
  );
  const pathname = usePathname();
  const { selectedBrandId } = useBrand();
  const hideUsageStrip = pathname?.startsWith('/admin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [userAvatar, setUserAvatar] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = React.useState(false);
  const [accessibilityModalKey, setAccessibilityModalKey] = React.useState(0);
  const t = useTranslations('Nav');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Try to get name from user_metadata, fallback to email username
          const name
            = session.user.user_metadata?.full_name
              || session.user.user_metadata?.name
              || session.user.email?.split('@')[0]
              || 'User';
          setUserName(name);

          // Fetch avatar from public.users table
          const { data: userRecord } = await supabase
            .from('users')
            .select('avatar_url, name')
            .eq('id', session.user.id)
            .maybeSingle();

          if (userRecord?.avatar_url) {
            setUserAvatar(userRecord.avatar_url);
            setAvatarError(false); // Reset error state for new avatar
          } else if (userRecord?.name) {
            // Use name from database if available
            setUserName(userRecord.name);
          }

          // Check admin status via API (server-side check, doesn't expose email)
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const adminCheckResponse = await fetch('/api/admin/check', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (adminCheckResponse.ok) {
              const adminData = await adminCheckResponse.json();
              setIsAdmin(adminData.isAdmin || false);
            } else {
              setIsAdmin(false);
            }
          } catch (error: any) {
            // Silently handle network errors (expected if server is down or route doesn't exist)
            // Only log unexpected errors
            if (error.name !== 'AbortError' && error.name !== 'NetworkError' && error.name !== 'TypeError') {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Admin check failed (non-critical):', error.message || error);
              }
            }
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  return (
    <div dir={dir} className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-white font-sans dark:bg-gray-900">
      {/* Sidebar */}
      <aside className={`absolute inset-y-0 right-0 z-30 w-64 transform space-y-3 bg-white px-2 py-5 text-gray-800 shadow-lg transition-[transform] duration-300 ease-out will-change-transform lg:relative lg:translate-x-0 lg:shadow-none dark:border-l dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="space-y-1.5 px-4">
          <div className="flex items-center justify-between">
            <div className="shrink-0 pb-1">
              <Logo width={130} height={35} />
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <Suspense fallback={<div className="h-10" />}>
            <BrandSelector />
          </Suspense>
        </div>
        <nav className="space-y-1 px-2">
          {navItems.map(({ href, key, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-200 ease-out ${active ? 'bg-pink-50 font-semibold text-pink-600 dark:bg-pink-900/20 dark:text-pink-400' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="leading-snug">{t(key)}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-200 ease-out ${pathname?.startsWith('/admin') ? 'bg-pink-50 font-semibold text-pink-600 dark:bg-pink-900/20 dark:text-pink-400' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
            >
              <Shield className="h-5 w-5 shrink-0" />
              <span className="leading-snug">{t('admin')}</span>
            </Link>
          )}
          <div className="space-y-1 pt-2">
            <button
              type="button"
              onClick={() => {
                setAccessibilityModalKey(k => k + 1);
                setIsAccessibilityOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-gray-700 transition-colors duration-200 ease-out hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Accessibility className="h-5 w-5 shrink-0" aria-hidden />
              <span className="leading-snug">{t('accessibility')}</span>
            </button>
            <SignOutButton />
          </div>
        </nav>
        <AccessibilityModal
          key={accessibilityModalKey}
          open={isAccessibilityOpen}
          onOpenChange={setIsAccessibilityOpen}
        />
      </aside>

      {/* Main */}
      <div className="flex w-full min-w-0 flex-1 flex-col">
        <header
          className={`flex flex-col bg-white shadow-sm dark:border-b dark:border-gray-800 dark:bg-gray-900 ${locale === 'he' ? 'rtl' : ''}`}
        >
          <div
            className={`flex items-center p-4 ${locale === 'he'
              ? 'flex-row-reverse'
              : ''} justify-between`}
          >
            {locale === 'he'
              ? (
            // Hebrew: Language switcher on left, user data on right
                  <>
                    {userName && (
                      <div className="flex items-center">
                        <LocaleSwitcher />
                      </div>
                    )}
                    <div className="flex flex-row-reverse items-center gap-4">
                      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                        <Menu className="h-6 w-6" />
                      </Button>
                      {userName && (
                        <div className="flex flex-row-reverse items-center gap-3">
                          <h1 className="text-lg font-semibold whitespace-nowrap text-gray-800 dark:text-gray-200">
                            {t('hello_greeting', { name: userName })}
                          </h1>
                          {userAvatar && !avatarError
                            ? (
                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-gray-200 dark:border-gray-600">
                                  <Image
                                    src={userAvatar}
                                    alt={userName}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                    unoptimized={!userAvatar.startsWith('/') && !userAvatar.includes('supabase.co') && !userAvatar.includes('getlate.dev')}
                                    onError={() => setAvatarError(true)}
                                  />
                                </div>
                              )
                            : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400">
                                  <User className="h-5 w-5" />
                                </div>
                              )}
                        </div>
                      )}
                    </div>
                  </>
                )
              : (
            // English: User data on left, language switcher on right
                  <>
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                        <Menu className="h-6 w-6" />
                      </Button>
                      {userName && (
                        <div className="flex items-center gap-3">
                          {userAvatar && !avatarError
                            ? (
                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-gray-200 dark:border-gray-600">
                                  <Image
                                    src={userAvatar}
                                    alt={userName}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                    unoptimized={!userAvatar.startsWith('/') && !userAvatar.includes('supabase.co') && !userAvatar.includes('getlate.dev')}
                                    onError={() => setAvatarError(true)}
                                  />
                                </div>
                              )
                            : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400">
                                  <User className="h-5 w-5" />
                                </div>
                              )}
                          <h1 className="text-lg font-semibold whitespace-nowrap text-gray-800 dark:text-gray-200">
                            {t('hello_greeting', { name: userName })}
                          </h1>
                        </div>
                      )}
                    </div>
                    {userName && (
                      <div className="flex items-center">
                        <LocaleSwitcher />
                      </div>
                    )}
                  </>
                )}
          </div>
          {!hideUsageStrip && (
            <SubscriptionLimitsMeters variant="topbar" brandId={selectedBrandId} className="shrink-0" />
          )}
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-0 py-6">{children}</main>
      </div>
    </div>
  );
}
