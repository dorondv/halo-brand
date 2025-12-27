'use client';

import type { Conversation, MetaPlatform } from '@/libs/meta-inbox';
import { Facebook, Instagram, Mail, MessageSquare, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/libs/cn';

const platformIcons = {
  facebook: { icon: Facebook, color: 'text-blue-600' },
  instagram: { icon: Instagram, color: 'text-pink-500' },
  threads: { icon: MessageSquare, color: 'text-neutral-900' },
  email: { icon: Mail, color: 'text-gray-600' },
} as const;

type ConversationListProps = {
  accountName: string;
  accountAvatar?: string;
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  filter: 'all' | 'unread' | 'read';
  onFilterChange: (filter: 'all' | 'unread' | 'read') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  locale: string;
  onRefresh?: () => void;
  isLoading?: boolean;
};

export function ConversationList({
  accountName,
  accountAvatar: _accountAvatar,
  conversations,
  selectedConversationId,
  onSelectConversation,
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  locale,
  onRefresh: _onRefresh,
  isLoading = false,
}: ConversationListProps) {
  const t = useTranslations('Inbox');
  const isRTL = locale === 'he';
  const filteredConversations = conversations.filter((conv) => {
    // Apply filter
    if (filter === 'unread' && conv.status !== 'unread') {
      return false;
    }
    if (filter === 'read' && conv.status !== 'read') {
      return false;
    }

    // Apply search
    if (searchTerm && !conv.contactName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Get selected conversation for header display
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Group conversations by date
  const groupedConversations = filteredConversations.reduce((groups, conv) => {
    const date = new Date(conv.lastMessageTime);
    // Format as DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateKey = `${day}/${month}/${year}`;

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(conv);
    return groups;
  }, {} as Record<string, Conversation[]>);

  // Sort dates (most recent first) - sort by actual date objects
  const sortedDates = Object.keys(groupedConversations).sort((a, b) => {
    const partsA = a.split('/').map(Number);
    const partsB = b.split('/').map(Number);
    const [dayA, monthA, yearA] = partsA;
    const [dayB, monthB, yearB] = partsB;

    if (!dayA || !monthA || !yearA || !dayB || !monthB || !yearB) {
      return 0;
    }

    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className={cn('flex h-full flex-1 flex-col bg-white', isRTL ? 'border-l' : 'border-r', 'border-gray-200')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        {/* Selected Conversation Name and Type */}
        {selectedConversation
          ? (
              <div className={cn('mb-4', isRTL && 'text-right')}>
                <h1 className="mb-1 text-xl font-semibold text-gray-900">
                  {selectedConversation.contactName}
                </h1>
                <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                  <span className="text-sm text-gray-600">
                    {selectedConversation.type === 'chat' ? t('private_message') : t('comment')}
                  </span>
                  {(() => {
                    const platform = selectedConversation.platform as MetaPlatform;
                    const { icon: Icon, color } = platformIcons[platform] || platformIcons.facebook;
                    return <Icon className={`h-4 w-4 ${color}`} />;
                  })()}
                </div>
              </div>
            )
          : (
              <div className={cn('mb-4', isRTL && 'text-right')}>
                <h1 className="mb-1 text-xl font-semibold text-gray-900">
                  {accountName}
                </h1>
                <span className="text-sm text-gray-600">{t('title')}</span>
              </div>
            )}

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10', isRTL ? 'right-3' : 'left-3')} />
          <Input
            type="text"
            placeholder={t('search_conversation')}
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className={cn('h-10 w-full bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:bg-white focus-visible:border-pink-300 focus-visible:ring-pink-500', isRTL ? 'pr-9' : 'pl-9')}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'unread', 'read'] as const).map((filterOption) => {
            const labels = {
              all: t('filter_all'),
              unread: t('filter_unread'),
              read: t('filter_unresolved'),
            };

            return (
              <Button
                key={filterOption}
                variant={filter === filterOption ? 'default' : 'ghost'}
                size="sm"
                className={`h-8 px-4 text-sm ${
                  filter === filterOption
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => onFilterChange(filterOption)}
              >
                {labels[filterOption]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading
          ? (
              <div className="flex h-full items-center justify-center p-4">
                <div className={cn('text-center', isRTL && 'text-right')}>
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-pink-500" />
                  <p className="text-sm text-gray-500">{t('loading_conversations')}</p>
                </div>
              </div>
            )
          : filteredConversations.length === 0
            ? (
                <div className="flex h-full items-center justify-center p-4">
                  <div className={cn('text-center', isRTL && 'text-right')}>
                    <p className="text-sm text-gray-500">
                      {searchTerm
                        ? t('no_comments_found')
                        : t('no_comments_yet')}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {t('permissions_hint')}
                    </p>
                  </div>
                </div>
              )
            : (
                <div>
                  {sortedDates.map(dateKey => (
                    <div key={dateKey} className="mb-6">
                      {/* Date Header */}
                      <div className="bg-gray-50 px-6 py-2">
                        <p className={cn('text-xs font-medium text-gray-500', isRTL && 'text-right')}>{dateKey}</p>
                      </div>

                      {/* Conversations for this date */}
                      <div>
                        {(groupedConversations[dateKey] || []).map((conversation) => {
                          const isSelected = selectedConversationId === conversation.id;
                          const hasUnread = conversation.unreadCount > 0;
                          const platform = conversation.platform as MetaPlatform;
                          const { icon: PlatformIcon, color } = platformIcons[platform] || platformIcons.facebook;

                          return (
                            <div
                              key={conversation.id}
                              onClick={() => onSelectConversation(conversation)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onSelectConversation(conversation);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className={cn(
                                'group cursor-pointer px-6 py-4 transition-colors',
                                isSelected ? 'bg-pink-50 text-pink-900' : 'hover:bg-gray-50',
                                isRTL
                                  ? isSelected ? 'border-r-4 border-r-pink-500' : 'border-r-4 border-r-transparent'
                                  : isSelected ? 'border-l-4 border-l-pink-500' : 'border-l-4 border-l-transparent',
                              )}
                            >
                              <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                  {conversation.contactAvatar
                                    ? (
                                        <>
                                          <Image
                                            src={conversation.contactAvatar}
                                            alt={conversation.contactName}
                                            width={48}
                                            height={48}
                                            className="h-12 w-12 rounded-full object-cover"
                                            unoptimized={conversation.contactAvatar.includes('cdninstagram.com') || conversation.contactAvatar.includes('fbsbx.com') || conversation.contactAvatar.includes('fbcdn.net')}
                                            onError={(e) => {
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
                                              {conversation.contactName.charAt(0).toUpperCase()}
                                            </span>
                                          </div>
                                        </>
                                      )
                                    : (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                                          <span className="text-base font-semibold text-gray-600">
                                            {conversation.contactName.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                </div>

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                  <div className={cn('flex items-start justify-between gap-2 mb-1', isRTL && 'flex-row-reverse')}>
                                    <p className={cn('truncate text-sm font-semibold', isSelected ? 'text-pink-900' : 'text-gray-900')}>
                                      {conversation.contactName}
                                    </p>
                                    {/* Platform Icon */}
                                    <PlatformIcon className={`h-4 w-4 ${color} flex-shrink-0`} />
                                  </div>
                                  <p className={`line-clamp-2 text-sm ${
                                    hasUnread ? 'font-medium text-gray-900' : 'text-gray-600'
                                  }`}
                                  >
                                    {conversation.lastMessage || 'No message'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
      </div>
    </div>
  );
}
