'use client';

import {
  BarChart3,
  Calendar as CalendarIcon,
  FileText,
  Headphones,
  LayoutDashboard,
  Mail,
  Menu,
  PenTool,
  Settings,
  Tags,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import React, { Suspense } from 'react';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { BrandSelector } from '@/components/BrandSelector';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/Logo';
import { usePathname } from '@/libs/I18nNavigation';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

type Props = {
  children: React.ReactNode;
};

const baseNav = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/inbox', key: 'inbox', icon: Mail },
  { href: '/create-post', key: 'create_post', icon: PenTool },
  { href: '/calendar', key: 'calendar', icon: CalendarIcon },
  { href: '/analytics', key: 'analytics', icon: BarChart3 },
  { href: '/reports', key: 'reports', icon: FileText },
  { href: '/connections', key: 'connections', icon: Settings },
  { href: '/settings', key: 'settings', icon: Settings },
  { href: '/support', key: 'support', icon: Headphones },
  { href: '/pricing', key: 'pricing', icon: Tags },
] as const;

export function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [userName, setUserName] = React.useState<string | null>(null);
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
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  return (
    <div dir={dir} className="flex min-h-screen w-full bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className={`absolute inset-y-0 right-0 w-64 transform space-y-6 bg-white px-2 py-7 text-gray-800 transition duration-200 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'} z-30 shadow-lg lg:shadow-none`}>
        <div className="space-y-2 px-4">
          <div className="flex items-center justify-between">
            <div className="shrink-0 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 p-1">
              <Logo width={120} height={30} className="text-white" />
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
          {baseNav.map(({ href, key, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center rounded-lg px-4 py-3 transition-colors duration-200 ${locale === 'he' ? 'gap-4' : 'gap-2'} ${active ? 'bg-white font-semibold text-pink-600' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{t(key)}</span>
              </Link>
            );
          })}
          <div className="pt-4">
            <SignOutButton />
          </div>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
            {userName && (
              <h1 className="text-lg font-semibold text-gray-800">
                {t('hello_greeting', { name: userName })}
              </h1>
            )}
          </div>
          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
