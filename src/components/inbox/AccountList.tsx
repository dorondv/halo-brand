'use client';

import type { InboxAccount, MetaPlatform } from '@/libs/meta-inbox';
import {
  Bird,
  Bookmark,
  CircleDot,
  Cloud,
  Facebook,
  Instagram,
  Linkedin,
  MessageSquare,
  Music2,
  Search,
  Send,
  Youtube,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/libs/cn';

const platformIcons: Record<MetaPlatform, { icon: typeof Facebook; color: string }> = {
  facebook: { icon: Facebook, color: 'text-blue-600' },
  instagram: { icon: Instagram, color: 'text-pink-500' },
  threads: { icon: MessageSquare, color: 'text-neutral-900' },
  twitter: { icon: Bird, color: 'text-sky-500' },
  bluesky: { icon: Cloud, color: 'text-sky-400' },
  reddit: { icon: CircleDot, color: 'text-orange-600' },
  telegram: { icon: Send, color: 'text-sky-600' },
  linkedin: { icon: Linkedin, color: 'text-blue-700' },
  youtube: { icon: Youtube, color: 'text-red-600' },
  tiktok: { icon: Music2, color: 'text-neutral-900' },
  pinterest: { icon: Bookmark, color: 'text-red-700' },
};

type AccountListProps = {
  accounts: InboxAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (account: InboxAccount) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  locale: string;
  inboxType: 'chat' | 'comment';
  onInboxTypeChange: (type: 'chat' | 'comment') => void;
};

export function AccountList({
  accounts,
  selectedAccountId,
  onSelectAccount,
  searchTerm,
  onSearchChange,
  locale,
  inboxType,
  onInboxTypeChange,
}: AccountListProps) {
  const t = useTranslations('Inbox');
  const isRTL = locale === 'he';
  const q = searchTerm.trim().toLowerCase();
  const filteredAccounts = accounts.filter((account) => {
    if (!q) {
      return true;
    }
    const name = account.accountName.toLowerCase();
    const plat = account.platform.toLowerCase();
    const brand = (account.brandName ?? '').toLowerCase();
    return name.includes(q) || plat.includes(q) || brand.includes(q);
  });

  return (
    <div className={cn('flex h-full w-[280px] flex-shrink-0 flex-col bg-white dark:bg-gray-900', isRTL ? 'border-l' : 'border-r', 'border-gray-200 dark:border-gray-700')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className={cn('mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100', isRTL && 'text-right')}>{t('title')}</h2>
        <div className={cn('mb-3', isRTL && 'text-right')}>
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="inbox-type-select">
            {t('inbox_view_type')}
          </label>
          <Select
            value={inboxType}
            onValueChange={v => onInboxTypeChange(v as 'chat' | 'comment')}
          >
            <SelectTrigger id="inbox-type-select" dir={isRTL ? 'rtl' : 'ltr'} className="h-9 text-sm">
              <SelectValue
                options={[
                  { value: 'chat', name: t('inbox_type_chat') },
                  { value: 'comment', name: t('inbox_type_comment') },
                ]}
              />
            </SelectTrigger>
            <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
              <SelectItem value="chat" dir={isRTL ? 'rtl' : 'ltr'}>{t('inbox_type_chat')}</SelectItem>
              <SelectItem value="comment" dir={isRTL ? 'rtl' : 'ltr'}>{t('inbox_type_comment')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10', isRTL ? 'right-3' : 'left-3')} />
          <Input
            placeholder={t('search_accounts')}
            className={cn('h-10 w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus-visible:bg-white dark:focus-visible:bg-gray-800 focus-visible:border-pink-300 focus-visible:ring-pink-500', isRTL ? 'pr-9' : 'pl-9')}
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>
      </div>

      {/* Account List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAccounts.length === 0
          ? (
              <div className="flex h-full items-center justify-center p-4">
                <p className={cn('text-sm text-gray-500', isRTL && 'text-right')}>
                  {searchTerm ? t('no_accounts_found') : t('no_accounts')}
                </p>
              </div>
            )
          : (
              <div className="p-2">
                {filteredAccounts.map((account) => {
                  const { icon: Icon, color } = platformIcons[account.platform] ?? {
                    icon: MessageSquare,
                    color: 'text-gray-500',
                  };
                  const isSelected = selectedAccountId === account.id;
                  const hasUnread = account.unreadCount > 0;

                  return (
                    <div
                      key={account.id}
                      onClick={() => onSelectAccount(account)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAccount(account);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors',
                        isSelected
                          ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-900 dark:text-pink-100'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                        isRTL
                          ? isSelected
                            ? 'border-r-4 border-r-pink-500'
                            : 'border-r-4 border-r-transparent'
                          : isSelected
                            ? 'border-l-4 border-l-pink-500'
                            : 'border-l-4 border-l-transparent',
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {account.avatarUrl
                          ? (
                              <>
                                <Image
                                  src={account.avatarUrl}
                                  alt={account.accountName}
                                  width={48}
                                  height={48}
                                  className="h-12 w-12 rounded-full object-cover"
                                  unoptimized={!account.avatarUrl.startsWith('/') && !account.avatarUrl.includes('supabase.co') && !account.avatarUrl.includes('getlate.dev')}
                                  onError={(e) => {
                                    // Fallback to initials if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback) {
                                      fallback.style.display = 'flex';
                                    }
                                  }}
                                />
                                <div className="hidden h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                                  <span className="text-base font-semibold text-gray-600">
                                    {account.accountName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </>
                            )
                          : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                                <span className="text-base font-semibold text-gray-600">
                                  {account.accountName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                        {/* Platform Icon Overlay */}
                        <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
                          <Icon className={`h-3 w-3 ${color}`} />
                        </div>
                        {/* Unread Indicator */}
                        {hasUnread && (
                          <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-pink-500 shadow-sm">
                            <span className="text-[10px] font-semibold text-white">
                              {account.unreadCount > 9 ? '9+' : account.unreadCount}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Account Info */}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${
                          isSelected ? 'text-pink-900 dark:text-pink-100' : 'text-gray-900 dark:text-gray-100'
                        }`}
                        >
                          {account.accountName}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {account.brandName
                            ? (
                                <>
                                  <span className="font-medium text-gray-600 dark:text-gray-300">{account.brandName}</span>
                                  <span className="text-gray-400"> · </span>
                                  <span className="capitalize">{account.platform}</span>
                                </>
                              )
                            : (
                                <span className="capitalize">{account.platform}</span>
                              )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </div>
    </div>
  );
}
