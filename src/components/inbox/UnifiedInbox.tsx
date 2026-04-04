'use client';

import type { Conversation, InboxAccount, Message } from '@/libs/meta-inbox';
import { platformSupportsInboxChat, platformSupportsInboxComments } from '@/libs/inboxPlatformSupport';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/libs/cn';
import { AccountList } from './AccountList';
import { ChatWindow } from './ChatWindow';
import { ConversationList } from './ConversationList';

type UnifiedInboxProps = {
  locale: string;
};

export function UnifiedInbox({ locale }: UnifiedInboxProps) {
  const t = useTranslations('Inbox');
  const isRTL = locale === 'he';
  const [accounts, setAccounts] = useState<InboxAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InboxAccount | null>(null);
  const [conversationsByAccount, setConversationsByAccount] = useState<Record<string, Conversation[]>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [conversationSearchTerm, setConversationSearchTerm] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inboxType, setInboxType] = useState<'chat' | 'comment'>('chat');
  /** Zernio cursor pagination per account (Meta fallback has hasMore: false) */
  const [paginationByAccount, setPaginationByAccount] = useState<
    Record<string, { nextCursor: string | null; hasMore: boolean }>
  >({});

  const conversations = useMemo(() => {
    if (!selectedAccount) {
      return [];
    }
    let list = conversationsByAccount[selectedAccount.id] || [];
    if (filter === 'unread') {
      list = list.filter(c => c.status === 'unread');
    } else if (filter === 'read') {
      list = list.filter(c => c.status === 'read');
    }
    const q = conversationSearchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        c =>
          c.contactName.toLowerCase().includes(q)
          || (c.lastMessage || '').toLowerCase().includes(q)
          || (c.postContent || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [selectedAccount, conversationsByAccount, filter, conversationSearchTerm]);

  // Fetch all active accounts across brands; pick one and search locally in AccountList
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/inbox/accounts');
      if (response.ok) {
        const data = await response.json();
        const list: InboxAccount[] = data.accounts || [];
        setAccounts(list);
        setSelectedAccount((prev) => {
          if (list.length === 0) {
            return null;
          }
          if (prev && list.some(a => a.id === prev.id)) {
            return prev;
          }
          return list[0] ?? null;
        });
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('[UnifiedInbox] Error fetching accounts:', error);
    }
  }, []);

  const refreshAccountConversations = useCallback(async (accountId: string) => {
    try {
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        const modeOk = inboxType === 'chat'
          ? platformSupportsInboxChat(acc.platform)
          : platformSupportsInboxComments(acc.platform);
        if (!modeOk) {
          return;
        }
      }
      const params = new URLSearchParams({
        accountId,
        type: inboxType,
        filter: 'all',
        limit: '50',
      });
      const response = await fetch(`/api/inbox/conversations?${params.toString()}`);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setConversationsByAccount(prev => ({
        ...prev,
        [accountId]: data.conversations || [],
      }));
      setPaginationByAccount(prev => ({
        ...prev,
        [accountId]: {
          nextCursor: data.nextCursor ?? null,
          hasMore: !!data.hasMore,
        },
      }));
    } catch (error) {
      console.error('[UnifiedInbox] Error refreshing conversations:', error);
    }
  }, [accounts, inboxType]);

  const loadMoreConversations = useCallback(async () => {
    if (!selectedAccount) {
      return;
    }
    const modeOk = inboxType === 'chat'
      ? platformSupportsInboxChat(selectedAccount.platform)
      : platformSupportsInboxComments(selectedAccount.platform);
    if (!modeOk) {
      return;
    }
    const accountId = selectedAccount.id;
    const pag = paginationByAccount[accountId];
    if (!pag?.hasMore || !pag.nextCursor || isLoadingMoreConversations) {
      return;
    }
    setIsLoadingMoreConversations(true);
    try {
      const params = new URLSearchParams({
        accountId,
        type: inboxType,
        filter: 'all',
        limit: '50',
        cursor: pag.nextCursor,
      });
      const response = await fetch(`/api/inbox/conversations?${params.toString()}`);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const newConvs = (data.conversations || []) as Conversation[];
      setConversationsByAccount((prev) => {
        const existing = prev[accountId] || [];
        const seen = new Set(existing.map(c => c.id));
        const merged = [...existing];
        for (const c of newConvs) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            merged.push(c);
          }
        }
        return { ...prev, [accountId]: merged };
      });
      setPaginationByAccount(prev => ({
        ...prev,
        [accountId]: {
          nextCursor: data.nextCursor ?? null,
          hasMore: !!data.hasMore,
        },
      }));
    } catch (error) {
      console.error('[UnifiedInbox] Error loading more conversations:', error);
    } finally {
      setIsLoadingMoreConversations(false);
    }
  }, [selectedAccount, inboxType, paginationByAccount, isLoadingMoreConversations]);

  // Prefetch threads (chat or post comments) for every connected account when accounts or inbox type changes
  useEffect(() => {
    if (accounts.length === 0) {
      setConversationsByAccount({});
      setPaginationByAccount({});
      return;
    }
    let cancelled = false;
    setIsLoadingConversations(true);
    setPaginationByAccount({});
    void (async () => {
      const results = await Promise.allSettled(
        accounts.map(async (acc) => {
          const modeOk = inboxType === 'chat'
            ? platformSupportsInboxChat(acc.platform)
            : platformSupportsInboxComments(acc.platform);
          if (!modeOk) {
            return {
              id: acc.id,
              conversations: [] as Conversation[],
              nextCursor: null,
              hasMore: false,
            };
          }
          const params = new URLSearchParams({
            accountId: acc.id,
            type: inboxType,
            filter: 'all',
            limit: '50',
          });
          const res = await fetch(`/api/inbox/conversations?${params.toString()}`);
          const data = res.ok
            ? await res.json()
            : { conversations: [], nextCursor: null, hasMore: false };
          return {
            id: acc.id,
            conversations: (data.conversations || []) as Conversation[],
            nextCursor: data.nextCursor ?? null,
            hasMore: !!data.hasMore,
          };
        }),
      );
      if (cancelled) {
        return;
      }
      const next: Record<string, Conversation[]> = {};
      const nextPag: Record<string, { nextCursor: string | null; hasMore: boolean }> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value.conversations;
          nextPag[r.value.id] = {
            nextCursor: r.value.nextCursor,
            hasMore: r.value.hasMore,
          };
        }
      }
      setConversationsByAccount(next);
      setPaginationByAccount(nextPag);
      setIsLoadingConversations(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accounts, inboxType]);

  // If the selected account does not support the current inbox mode, switch to a supported one
  useEffect(() => {
    if (!selectedAccount) {
      return;
    }
    const chatOk = platformSupportsInboxChat(selectedAccount.platform);
    const commentOk = platformSupportsInboxComments(selectedAccount.platform);
    if (inboxType === 'chat' && !chatOk && commentOk) {
      setInboxType('comment');
    } else if (inboxType === 'comment' && !commentOk && chatOk) {
      setInboxType('chat');
    }
  }, [selectedAccount, inboxType]);

  useEffect(() => {
    setSelectedConversation(null);
    setMessages([]);
  }, [inboxType]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async () => {
    if (!selectedConversation || !selectedAccount) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    try {
      const params = new URLSearchParams({
        conversationId: selectedConversation.id,
        accountId: selectedAccount.id,
        platform: selectedConversation.platform,
        type: selectedConversation.type,
      });

      if (selectedConversation.zernioSocialAccountId) {
        params.append('zernioAccountId', selectedConversation.zernioSocialAccountId);
      }

      // For comment conversations, include postId to fetch all comments on the post
      if (selectedConversation.type === 'comment' && selectedConversation.postId) {
        params.append('postId', selectedConversation.postId);
      }

      const url = `/api/inbox/messages?${params.toString()}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('[UnifiedInbox] Error fetching messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedConversation, selectedAccount]);

  // Load accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Fetch messages when conversation changes
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Handle account selection
  const handleSelectAccount = (account: InboxAccount) => {
    setSelectedAccount(account);
    setSelectedConversation(null);
    setMessages([]);
  };

  // Handle conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    if (conversation.inboxAccountId && accounts.some(a => a.id === conversation.inboxAccountId)) {
      const acc = accounts.find(a => a.id === conversation.inboxAccountId);
      if (acc && acc.id !== selectedAccount?.id) {
        setSelectedAccount(acc);
      }
    }
    setSelectedConversation(conversation);
  };

  // Handle sending a message
  const handleSendMessage = async (message: string, mentionUserId?: string, mentionName?: string, replyToCommentId?: string) => {
    if (!selectedConversation || !selectedAccount) {
      return;
    }

    try {
      // Zernio unified inbox (DMs): profile on Zernio === brand getlate_profile_id; send via inbox API
      if (selectedConversation.type === 'chat' && selectedConversation.zernioSocialAccountId) {
        const response = await fetch('/api/inbox/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedConversation.id,
            message,
            accountId: selectedAccount.id,
            platform: selectedConversation.platform,
            zernioSocialAccountId: selectedConversation.zernioSocialAccountId,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send message');
        }
        await fetchMessages();
        setConversationsByAccount((prev) => {
          const id = selectedAccount.id;
          const list = prev[id] || [];
          return {
            ...prev,
            [id]: list.map(conv =>
              conv.id === selectedConversation.id
                ? {
                    ...conv,
                    lastMessage: message,
                    lastMessageTime: new Date().toISOString(),
                  }
                : conv,
            ),
          };
        });
        return;
      }

      // Determine commentId for reply
      // If replying to a specific comment (replyToCommentId provided), use that comment's ID
      // Otherwise, if it's a comment conversation, reply to the post (create new top-level comment)
      // For chat conversations, use conversationId
      let replyCommentId: string | undefined;
      if (selectedConversation.type === 'comment') {
        if (replyToCommentId) {
          // Replying to a specific comment (creates a reply/thread)
          replyCommentId = replyToCommentId;
        } else {
          // Creating a new top-level comment (reply to the post)
          replyCommentId = selectedConversation.postId;
        }
      }

      const response = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message,
          accountId: selectedAccount.id,
          platform: selectedConversation.platform,
          commentId: replyCommentId, // Use postId for new top-level comments, or specific commentId for replies
          postId: selectedConversation.postId,
          mentionUserId,
          mentionName,
          zernioSocialAccountId: selectedConversation.zernioSocialAccountId,
        }),
      });

      if (response.ok) {
        // Refresh messages after sending
        await fetchMessages();
        setConversationsByAccount((prev) => {
          const id = selectedAccount.id;
          const list = prev[id] || [];
          return {
            ...prev,
            [id]: list.map(conv =>
              conv.id === selectedConversation.id
                ? {
                    ...conv,
                    lastMessage: message,
                    lastMessageTime: new Date().toISOString(),
                  }
                : conv,
            ),
          };
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const supportsInboxChat = useMemo(
    () => (selectedAccount ? platformSupportsInboxChat(selectedAccount.platform) : true),
    [selectedAccount],
  );
  const supportsInboxComment = useMemo(
    () => (selectedAccount ? platformSupportsInboxComments(selectedAccount.platform) : true),
    [selectedAccount],
  );

  return (
    <div className={cn('flex h-full w-full overflow-hidden bg-white dark:bg-gray-900', isRTL && 'flex-row-reverse')} dir={isRTL ? 'rtl' : 'ltr'}>
      {isRTL
        ? (
            <>
              {/* Right Section - Comment Window (RTL: appears on left) */}
              <ChatWindow
                conversation={selectedConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                locale={locale}
                isLoading={isLoadingMessages}
                accountId={selectedAccount?.id}
              />

              {/* Middle Section - Conversations */}
              {selectedAccount
                ? (
                    <ConversationList
                      accountName={selectedAccount.accountName}
                      accountAvatar={selectedAccount.avatarUrl}
                      conversations={conversations}
                      selectedConversationId={selectedConversation?.id || null}
                      onSelectConversation={handleSelectConversation}
                      filter={filter}
                      onFilterChange={setFilter}
                      searchTerm={conversationSearchTerm}
                      onSearchChange={setConversationSearchTerm}
                      locale={locale}
                      inboxType={inboxType}
                      onRefresh={() => selectedAccount && refreshAccountConversations(selectedAccount.id)}
                      isLoading={isLoadingConversations}
                      hasMore={paginationByAccount[selectedAccount.id]?.hasMore ?? false}
                      onLoadMore={loadMoreConversations}
                      isLoadingMore={isLoadingMoreConversations}
                    />
                  )
                : (
                    <div className={cn('flex h-full flex-1 items-center justify-center bg-white dark:bg-gray-900', 'border-l', 'border-gray-200 dark:border-gray-700')}>
                      <p className={cn('text-gray-500 dark:text-gray-400', 'text-right')}>
                        {t('select_account')}
                      </p>
                    </div>
                  )}

              {/* Left Sidebar - Accounts (RTL: appears on right) */}
              <AccountList
                accounts={accounts}
                selectedAccountId={selectedAccount?.id || null}
                onSelectAccount={handleSelectAccount}
                searchTerm={accountSearchTerm}
                onSearchChange={setAccountSearchTerm}
                locale={locale}
                inboxType={inboxType}
                onInboxTypeChange={setInboxType}
                supportsInboxChat={supportsInboxChat}
                supportsInboxComment={supportsInboxComment}
              />
            </>
          )
        : (
            <>
              {/* Left Sidebar - Accounts */}
              <AccountList
                accounts={accounts}
                selectedAccountId={selectedAccount?.id || null}
                onSelectAccount={handleSelectAccount}
                searchTerm={accountSearchTerm}
                onSearchChange={setAccountSearchTerm}
                locale={locale}
                inboxType={inboxType}
                onInboxTypeChange={setInboxType}
                supportsInboxChat={supportsInboxChat}
                supportsInboxComment={supportsInboxComment}
              />

              {/* Middle Section - Conversations */}
              {selectedAccount
                ? (
                    <ConversationList
                      accountName={selectedAccount.accountName}
                      accountAvatar={selectedAccount.avatarUrl}
                      conversations={conversations}
                      selectedConversationId={selectedConversation?.id || null}
                      onSelectConversation={handleSelectConversation}
                      filter={filter}
                      onFilterChange={setFilter}
                      searchTerm={conversationSearchTerm}
                      onSearchChange={setConversationSearchTerm}
                      locale={locale}
                      inboxType={inboxType}
                      onRefresh={() => selectedAccount && refreshAccountConversations(selectedAccount.id)}
                      isLoading={isLoadingConversations}
                      hasMore={paginationByAccount[selectedAccount.id]?.hasMore ?? false}
                      onLoadMore={loadMoreConversations}
                      isLoadingMore={isLoadingMoreConversations}
                    />
                  )
                : (
                    <div className={cn('flex h-full flex-1 items-center justify-center bg-white dark:bg-gray-900', 'border-r', 'border-gray-200 dark:border-gray-700')}>
                      <p className="text-gray-500 dark:text-gray-400">
                        {t('select_account')}
                      </p>
                    </div>
                  )}

              {/* Right Section - Comment Window */}
              <ChatWindow
                conversation={selectedConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                locale={locale}
                isLoading={isLoadingMessages}
                accountId={selectedAccount?.id}
              />
            </>
          )}
    </div>
  );
}
