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
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { BrandSelector } from '@/components/BrandSelector';
import { Button } from '@/components/ui/button';

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
  const t = useTranslations('Nav');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <div dir={dir} className="flex min-h-screen w-full bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className={`absolute inset-y-0 right-0 w-64 transform space-y-6 bg-white px-2 py-7 text-gray-800 transition duration-200 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'} z-30 shadow-lg lg:shadow-none`}>
        <div className="space-y-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <div className="rounded-lg bg-pink-500 p-2">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">Hello Brand</span>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <BrandSelector />
        </div>
        <nav className="space-y-1 px-2">
          {baseNav.map(({ href, key, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-4 py-3 transition-colors duration-200 rtl:space-x-reverse ${active ? 'bg-pink-500 text-white' : 'hover:bg-gray-200'}`}
              >
                <Icon className="h-5 w-5" />
                <span>{t(key)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between bg-white p-4 shadow-sm">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
