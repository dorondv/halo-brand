'use client';

import type { Conversation, MetaPlatform } from '@/libs/meta-inbox';
import {
  Bird,
  Bookmark,
  CircleDot,
  Cloud,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  MessageSquare,
  Music2,
  Search,
  Send,
  Youtube,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/libs/cn';

const platformIcons: Record<
  MetaPlatform | 'email',
  { icon: typeof Facebook; color: string }
> = {
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
  email: { icon: Mail, color: 'text-gray-600' },
};

function formatCommentPostDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function resolveCommentCount(conv: Conversation): number | null {
  if (typeof conv.commentCount === 'number' && conv.commentCount >= 0) {
    return conv.commentCount;
  }
  const m = (conv.lastMessage || '').trim().match(/^(\d+)\s+comment/i);
  if (m?.[1]) {
    return Number.parseInt(m[1], 10);
  }
  return null;
}

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
  /** When `comment`, list rows emphasize post + comment (vs DM-style list for `chat`). */
  inboxType: 'chat' | 'comment';
  onRefresh?: () => void;
  isLoading?: boolean;
  /** Zernio: more pages available via cursor */
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
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
  inboxType,
  onRefresh: _onRefresh,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: ConversationListProps) {
  const t = useTranslations('Inbox');
  const isRTL = locale === 'he';
  const q = searchTerm.trim().toLowerCase();
  const filteredConversations = conversations.filter((conv) => {
    // Apply filter
    if (filter === 'unread' && conv.status !== 'unread') {
      return false;
    }
    if (filter === 'read' && conv.status !== 'read') {
      return false;
    }

    // Apply search (name, comment text, post caption)
    if (q) {
      const name = conv.contactName.toLowerCase();
      const last = (conv.lastMessage || '').toLowerCase();
      const post = (conv.postContent || '').toLowerCase();
      if (!name.includes(q) && !last.includes(q) && !post.includes(q)) {
        return false;
      }
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
    <div className={cn('flex h-full flex-1 flex-col bg-white dark:bg-gray-900', isRTL ? 'border-l' : 'border-r', 'border-gray-200 dark:border-gray-700')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        {/* Selected Conversation Name and Type */}
        {selectedConversation
          ? (
              <div className={cn('mb-4', isRTL && 'text-right')}>
                <div className={cn('flex items-center gap-3 mb-2', isRTL && 'flex-row-reverse')}>
                  {/* Avatar */}
                  {selectedConversation.contactAvatar
                    ? (
                        <>
                          <Image
                            src={selectedConversation.contactAvatar}
                            alt={selectedConversation.contactName}
                            width={40}
                            height={40}
                            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                            unoptimized={!selectedConversation.contactAvatar.startsWith('/') && !selectedConversation.contactAvatar.includes('supabase.co') && !selectedConversation.contactAvatar.includes('getlate.dev')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) {
                                fallback.style.display = 'flex';
                              }
                            }}
                          />
                          <div className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
                            <span className="text-sm font-semibold text-gray-600">
                              {selectedConversation.contactName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </>
                      )
                    : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
                          <span className="text-sm font-semibold text-gray-600">
                            {selectedConversation.contactName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {selectedConversation.contactName}
                    </h1>
                    <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedConversation.type === 'chat' ? t('private_message') : t('comment')}
                      </span>
                      {(() => {
                        const platform = selectedConversation.platform as MetaPlatform;
                        const { icon: Icon, color } = platformIcons[platform] ?? platformIcons.facebook;
                        return <Icon className={`h-4 w-4 ${color} flex-shrink-0`} />;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )
          : (
              <div className={cn('mb-4', isRTL && 'text-right')}>
                <h1 className="mb-1 text-xl font-semibold text-gray-900">
                  {accountName}
                </h1>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {inboxType === 'comment' ? t('comments_posts_subtitle') : t('title')}
                </span>
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
            className={cn('h-10 w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus-visible:bg-white dark:focus-visible:bg-gray-800 focus-visible:border-pink-300 focus-visible:ring-pink-500', isRTL ? 'pr-9' : 'pl-9')}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'unread', 'read'] as const).map((filterOption) => {
            const labels = {
              all: t('filter_all'),
              unread: t('filter_unread'),
              read: t('filter_read'),
            };

            return (
              <Button
                key={filterOption}
                variant={filter === filterOption ? 'default' : 'ghost'}
                size="sm"
                className={`h-8 px-4 text-sm ${
                  filter === filterOption
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {searchTerm
                        ? t('no_comments_found')
                        : t('no_comments_yet')}
                    </p>
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
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
                      <div className="bg-gray-50 px-6 py-2 dark:bg-gray-800">
                        <p className={cn('text-xs font-medium text-gray-500 dark:text-gray-400', isRTL && 'text-right')}>{dateKey}</p>
                      </div>

                      {/* Conversations for this date */}
                      <div>
                        {(groupedConversations[dateKey] || []).map((conversation) => {
                          const isSelected = selectedConversationId === conversation.id;
                          const hasUnread = conversation.unreadCount > 0;
                          const platform = conversation.platform as MetaPlatform;
                          const { icon: PlatformIcon, color } = platformIcons[platform] ?? platformIcons.facebook;

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
                                isSelected ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-900 dark:text-pink-100' : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                                isRTL
                                  ? isSelected ? 'border-r-4 border-r-pink-500' : 'border-r-4 border-r-transparent'
                                  : isSelected ? 'border-l-4 border-l-pink-500' : 'border-l-4 border-l-transparent',
                              )}
                            >
                              {inboxType === 'comment' && conversation.type === 'comment'
                                ? (
                                    <div className={cn('flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800/70', isRTL && 'flex-row-reverse')}>
                                      {conversation.postImageUrl
                                        ? (
                                            <Image
                                              src={conversation.postImageUrl}
                                              alt=""
                                              width={56}
                                              height={56}
                                              className="h-14 w-14 shrink-0 rounded-md object-cover"
                                              unoptimized={!conversation.postImageUrl.startsWith('/') && !conversation.postImageUrl.includes('supabase.co') && !conversation.postImageUrl.includes('getlate.dev')}
                                            />
                                          )
                                        : (
                                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gray-200 dark:bg-gray-700">
                                              <MessageSquare className="h-6 w-6 text-gray-400" />
                                            </div>
                                          )}
                                      <div className="min-w-0 flex-1">
                                        <div className={cn('mb-0.5 flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
                                          <span className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                                            {t('post_label')}
                                          </span>
                                          <PlatformIcon className={`h-4 w-4 ${color} shrink-0`} />
                                        </div>
                                        <p className="line-clamp-2 text-xs leading-snug text-gray-800 dark:text-gray-200">
                                          {conversation.postContent?.trim() || t('post_no_caption')}
                                        </p>
                                        {(() => {
                                          const n = resolveCommentCount(conversation);
                                          const dateStr = formatCommentPostDate(
                                            conversation.lastMessageTime,
                                            locale,
                                          );
                                          if (n == null && !dateStr) {
                                            return null;
                                          }
                                          const rowJustify
                                            = n != null && dateStr
                                              ? 'justify-between gap-4'
                                              : n != null
                                                ? 'justify-start'
                                                : 'justify-end';
                                          return (
                                            <div
                                              className={cn(
                                                'mt-2 flex w-full min-w-0 items-center text-xs text-gray-500 dark:text-gray-400',
                                                rowJustify,
                                                isRTL && n != null && dateStr && 'flex-row-reverse',
                                              )}
                                            >
                                              {n != null
                                                ? (
                                                    <span
                                                      className={cn(
                                                        'inline-flex items-center gap-1 tabular-nums',
                                                        isRTL && 'flex-row-reverse',
                                                      )}
                                                    >
                                                      <MessageCircle
                                                        className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400"
                                                        strokeWidth={1.75}
                                                        aria-hidden
                                                      />
                                                      <span>{n}</span>
                                                    </span>
                                                  )
                                                : null}
                                              {dateStr
                                                ? (
                                                    <span className="shrink-0 text-gray-500 tabular-nums dark:text-gray-400">
                                                      {dateStr}
                                                    </span>
                                                  )
                                                : null}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )
                                : (
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
                                                  unoptimized={!conversation.contactAvatar.startsWith('/') && !conversation.contactAvatar.includes('supabase.co') && !conversation.contactAvatar.includes('getlate.dev')}
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
                                          <p className={cn('truncate text-sm font-semibold', isSelected ? 'text-pink-900 dark:text-pink-100' : 'text-gray-900 dark:text-gray-100')}>
                                            {conversation.contactName}
                                          </p>
                                          {/* Platform Icon */}
                                          <PlatformIcon className={`h-4 w-4 ${color} flex-shrink-0`} />
                                        </div>
                                        <p className={`line-clamp-2 text-sm ${
                                          hasUnread ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                                        }`}
                                        >
                                          {conversation.lastMessage || t('no_message')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
        {hasMore && onLoadMore && (
          <div className={cn('border-t border-gray-200 px-6 py-3 dark:border-gray-700', isRTL && 'text-right')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isLoadingMore}
              onClick={() => onLoadMore()}
            >
              {isLoadingMore ? t('loading_more') : t('load_more')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
