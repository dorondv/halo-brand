'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Zap,
  X,
  LayoutDashboard,
  PenTool,
  Calendar,
  BarChart3,
  Settings,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

type Props = {
  children: React.ReactNode;
};

const baseNav = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/create-post', key: 'create_post', icon: PenTool },
  { href: '/calendar', key: 'calendar', icon: Calendar },
  { href: '/analytics', key: 'analytics', icon: BarChart3 },
  { href: '/settings', key: 'settings', icon: Settings },
] as const;

export function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const t = useTranslations('Nav');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const isRTL = dir === 'rtl';
  const [userEmail, setUserEmail] = React.useState<string>('');
  const [userRole, setUserRole] = React.useState<string>('מנהלי תוכן');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email || '';
      setUserEmail(email);
      // If you store roles in JWT or user metadata, map them here. Using a sensible default.
      const role = (data.session?.user?.role as string) || 'מנהלי תוכן';
      setUserRole(role);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  const initials = React.useMemo(() => {
    const name = userEmail?.split('@')[0] || 'User';
    const parts = name.replace(/[^A-Za-zא-ת\s]/g, '').trim().split(/\s+/);
    const letters = parts.slice(0, 2).map(s => s[0]?.toUpperCase()).join('');
    return letters || 'מ';
  }, [userEmail]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div dir={dir} className="flex min-h-screen bg-gradient-to-br from-gray-50 to-white w-full">
      {/* Sidebar */}
      <aside
        className={`bg-white/70 backdrop-blur-xl text-gray-800 w-72 border-l border-gray-200 flex-col absolute inset-y-0 right-0 transform lg:relative lg:translate-x-0 transition duration-200 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          } z-30 shadow-lg lg:shadow-none flex`}
      >
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 brand-gradient rounded-2xl flex items-center justify-center brand-glow">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-xl tracking-tight">Hallo Branda</h2>
              <p className="text-xs text-gray-500 font-medium">It's All About Personal Branding</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6">
          <nav className="space-y-3">
            {baseNav.map(({ href, key, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 font-medium ${active
                    ? 'brand-gradient text-white shadow-lg brand-glow'
                    : 'text-gray-700 hover:bg-pink-50 hover:text-gray-900'
                    }`}
                >
                  <Icon className={`h-5 w-5`} />
                  <span className={`flex-1 text-right`}>{t(key)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-6 border-t border-gray-200">
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full text-left rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2">
                <div className="glass-light p-4 rounded-2xl hover:bg-white/90 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 brand-gradient rounded-full flex items-center justify-center font-bold text-white">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{userEmail || 'משתמש'}</p>
                      <p className="text-xs text-gray-500 truncate">{userRole}</p>
                    </div>
                  </div>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 mb-2 border-gray-200" align={dir === 'rtl' ? 'start' : 'end'} side="top">
              <div className="space-y-1 p-1">
                <div className="px-2 py-1.5">
                  <p className="font-semibold text-gray-900 text-sm">{userEmail || 'משתמש'}</p>
                  <p className="text-xs text-gray-500">{userRole}</p>
                </div>
                <div className="h-px bg-gray-200 my-1" />
                <Link
                  href="/settings"
                  className={`block w-full text-${dir === 'rtl' ? 'right' : 'left'} px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-pink-600 rounded-md transition-colors`}
                >
                  פרופיל משתמש
                </Link>
                <button
                  className={`w-full text-${dir === 'rtl' ? 'right' : 'left'} px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors`}
                  onClick={async () => {
                    const supabase = createSupabaseBrowserClient();
                    await supabase.auth.signOut();
                    window.location.href = '/sign-in';
                  }}
                >
                  התנתקות
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="bg-white/90 backdrop-blur-xl border-b border-gray-200 px-6 py-4 md:hidden shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 brand-gradient rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Hallo Branda</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-900 hover:bg-gray-100"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

