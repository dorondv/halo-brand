'use client';

import type { InboxAccount } from '@/libs/meta-inbox';
import { Facebook, Instagram, MessageSquare, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { cn } from '@/libs/cn';

const platformIcons = {
  facebook: { icon: Facebook, color: 'text-blue-600' },
  instagram: { icon: Instagram, color: 'text-pink-500' },
  threads: { icon: MessageSquare, color: 'text-neutral-900' },
} as const;

type AccountListProps = {
  accounts: InboxAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (account: InboxAccount) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  locale: string;
};

export function AccountList({
  accounts,
  selectedAccountId,
  onSelectAccount,
  searchTerm,
  onSearchChange,
  locale,
}: AccountListProps) {
  const t = useTranslations('Inbox');
  const isRTL = locale === 'he';
  const filteredAccounts = accounts.filter(account =>
    account.accountName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className={cn('flex h-full w-[280px] flex-shrink-0 flex-col bg-white', isRTL ? 'border-l' : 'border-r', 'border-gray-200')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4">
        <h2 className={cn('mb-4 text-lg font-semibold text-gray-900', isRTL && 'text-right')}>{t('title')}</h2>
        <div className="relative">
          <Search className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10', isRTL ? 'right-3' : 'left-3')} />
          <Input
            placeholder={t('search_accounts')}
            className={cn('h-10 w-full bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:bg-white focus-visible:border-pink-300 focus-visible:ring-pink-500', isRTL ? 'pr-9' : 'pl-9')}
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
                  const { icon: Icon, color } = platformIcons[account.platform] || {
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
                          ? 'bg-pink-50 text-pink-900'
                          : 'hover:bg-gray-50',
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
                                  unoptimized={account.avatarUrl.includes('cdninstagram.com') || account.avatarUrl.includes('fbsbx.com') || account.avatarUrl.includes('fbcdn.net')}
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
                        <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
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
                          isSelected ? 'text-pink-900' : 'text-gray-900'
                        }`}
                        >
                          {account.accountName}
                        </p>
                        <p className="truncate text-xs text-gray-500 capitalize">
                          {account.platform}
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
