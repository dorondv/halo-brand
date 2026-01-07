'use client';

import type { Conversation, InboxAccount, Message } from '@/libs/meta-inbox';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [conversationSearchTerm, setConversationSearchTerm] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/inbox/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(data.accounts[0]);
        }
      }
    } catch (error) {
      console.error('[UnifiedInbox] Error fetching accounts:', error);
    }
  }, [selectedAccount]);

  // Fetch conversations for selected account
  const fetchConversations = useCallback(async () => {
    if (!selectedAccount) {
      setConversations([]);
      return;
    }

    setIsLoadingConversations(true);
    try {
      const params = new URLSearchParams({
        accountId: selectedAccount.id,
        type: 'comment',
        filter: filter === 'all' ? 'all' : filter,
      });

      const url = `/api/inbox/conversations?${params.toString()}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('[UnifiedInbox] Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [selectedAccount, filter]);

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

  // Fetch conversations when account or filters change
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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
    setSelectedConversation(conversation);
  };

  // Handle sending a message
  const handleSendMessage = async (message: string, mentionUserId?: string, mentionName?: string, replyToCommentId?: string) => {
    if (!selectedConversation || !selectedAccount) {
      return;
    }

    try {
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
          mentionUserId,
          mentionName,
        }),
      });

      if (response.ok) {
        // Refresh messages after sending
        await fetchMessages();
        // Update conversation last message
        setConversations(prev =>
          prev.map(conv =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  lastMessage: message,
                  lastMessageTime: new Date().toISOString(),
                }
              : conv,
          ),
        );
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  return (
    <div className={cn('flex h-full w-full overflow-hidden bg-white', isRTL && 'flex-row-reverse')} dir={isRTL ? 'rtl' : 'ltr'}>
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
                      onRefresh={fetchConversations}
                      isLoading={isLoadingConversations}
                    />
                  )
                : (
                    <div className={cn('flex h-full flex-1 items-center justify-center bg-white', 'border-l', 'border-gray-200')}>
                      <p className={cn('text-gray-500', 'text-right')}>
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
                      onRefresh={fetchConversations}
                      isLoading={isLoadingConversations}
                    />
                  )
                : (
                    <div className={cn('flex h-full flex-1 items-center justify-center bg-white', 'border-r', 'border-gray-200')}>
                      <p className="text-gray-500">
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
