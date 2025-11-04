'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Facebook, Instagram, Linkedin, Mail, MessageSquare, Search, Youtube } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Force dynamic rendering - this page requires authentication

export const dynamic = 'force-dynamic';

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const platformIcons = {
  instagram: { icon: Instagram, color: 'text-pink-500' },
  twitter: { icon: XIcon, color: 'text-gray-800' },
  facebook: { icon: Facebook, color: 'text-blue-600' },
  linkedin: { icon: Linkedin, color: 'text-sky-700' },
  youtube: { icon: Youtube, color: 'text-red-600' },
  tiktok: { icon: TikTokIcon, color: 'text-black' },
  threads: { icon: MessageSquare, color: 'text-neutral-900' },
  email: { icon: Mail, color: 'text-gray-500' },
} as const;

type Conversation = {
  id: string;
  contact_name: string;
  contact_avatar: string;
  platform: keyof typeof platformIcons;
  type: string;
  last_message_snippet: string;
  last_message_timestamp: string;
  status: 'unread' | 'unresolved' | 'all';
};

type Message = {
  id: string;
  conversation_id: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  timestamp: string;
  is_outgoing: boolean;
};

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { icon: Icon, color } = platformIcons[conversation.platform] || { icon: MessageSquare, color: 'text-gray-500' };

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={`flex cursor-pointer items-start gap-3 border-r-4 p-3 transition-colors duration-200 ${
        isSelected ? 'border-pink-500 bg-pink-50' : 'border-transparent hover:bg-gray-50'
      }`}
    >
      <div className="relative flex-shrink-0">
        <Image src={conversation.contact_avatar} alt={conversation.contact_name} width={40} height={40} className="h-10 w-10 rounded-full" />
        <div className="absolute -right-1 -bottom-1 rounded-full bg-white p-0.5">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold text-gray-800">{conversation.contact_name}</p>
          <p className="flex-shrink-0 text-xs text-gray-400">
            {new Date(conversation.last_message_timestamp).toLocaleDateString()}
          </p>
        </div>
        <p className="truncate text-sm text-gray-500">{conversation.last_message_snippet}</p>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isOutgoing = message.is_outgoing;
  return (
    <div className={`my-2 flex items-end gap-2 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      {!isOutgoing && <Image src={message.sender_avatar || '/default-avatar.png'} alt={message.sender_name} width={32} height={32} className="h-8 w-8 rounded-full" />}
      <div
        className={`max-w-md rounded-2xl px-4 py-2 ${
          isOutgoing
            ? 'rounded-br-none bg-pink-500 text-white'
            : 'rounded-bl-none bg-gray-100 text-gray-800'
        }`}
      >
        <p>{message.content}</p>
        <p className={`mt-1 text-xs ${isOutgoing ? 'text-pink-100' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {isOutgoing && <Image src={message.sender_avatar || '/default-avatar.png'} alt={message.sender_name} width={32} height={32} className="h-8 w-8 rounded-full" />}
    </div>
  );
}

function ChatView({
  conversation,
  messages,
  onSendMessage,
}: {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
}) {
  const [newMessage, setNewMessage] = useState('');

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <Mail className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-500">Select a conversation to start</p>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="text-lg font-bold">{conversation.contact_name}</h2>
          <p className="flex items-center text-sm text-gray-500 capitalize">
            {platformIcons[conversation.platform]?.icon
              && React.createElement(platformIcons[conversation.platform].icon, { className: 'w-4 h-4 inline mr-1' })}
            {' '}
            {conversation.type.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ChatMessage message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="relative">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            className="pr-12"
          />
          <Button size="icon" variant="ghost" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={handleSend}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-pink-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Mock data
const mockConversations: Conversation[] = [
  {
    id: '1',
    contact_name: 'Sarah Johnson',
    contact_avatar: 'https://i.pravatar.cc/150?u=sarah',
    platform: 'instagram',
    type: 'direct_message',
    last_message_snippet: 'Thanks for the quick response!',
    last_message_timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: 'unread',
  },
  {
    id: '2',
    contact_name: 'Mike Chen',
    contact_avatar: 'https://i.pravatar.cc/150?u=mike',
    platform: 'twitter',
    type: 'mention',
    last_message_snippet: 'Great post about social media strategies',
    last_message_timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: 'unread',
  },
  {
    id: '3',
    contact_name: 'Emily Rodriguez',
    contact_avatar: 'https://i.pravatar.cc/150?u=emily',
    platform: 'facebook',
    type: 'comment',
    last_message_snippet: 'When will the new feature be available?',
    last_message_timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    status: 'unresolved',
  },
  {
    id: '4',
    contact_name: 'David Kim',
    contact_avatar: 'https://i.pravatar.cc/150?u=david',
    platform: 'linkedin',
    type: 'message',
    last_message_snippet: 'I would love to connect and discuss potential collaboration',
    last_message_timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: 'unread',
  },
  {
    id: '5',
    contact_name: 'Lisa Anderson',
    contact_avatar: 'https://i.pravatar.cc/150?u=lisa',
    platform: 'youtube',
    type: 'comment',
    last_message_snippet: 'Amazing video! Keep up the great work.',
    last_message_timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: 'all',
  },
];

const mockMessages: Record<string, Message[]> = {
  1: [
    {
      id: 'm1',
      conversation_id: '1',
      sender_name: 'Sarah Johnson',
      sender_avatar: 'https://i.pravatar.cc/150?u=sarah',
      content: 'Hi! I saw your latest post and had a question.',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      is_outgoing: false,
    },
    {
      id: 'm2',
      conversation_id: '1',
      sender_name: 'You',
      sender_avatar: 'https://i.pravatar.cc/150?u=user',
      content: 'Hi Sarah! I would be happy to help. What would you like to know?',
      timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      is_outgoing: true,
    },
    {
      id: 'm3',
      conversation_id: '1',
      sender_name: 'Sarah Johnson',
      sender_avatar: 'https://i.pravatar.cc/150?u=sarah',
      content: 'Thanks for the quick response!',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      is_outgoing: false,
    },
  ],
  2: [
    {
      id: 'm4',
      conversation_id: '2',
      sender_name: 'Mike Chen',
      sender_avatar: 'https://i.pravatar.cc/150?u=mike',
      content: 'Great post about social media strategies',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      is_outgoing: false,
    },
  ],
  3: [
    {
      id: 'm5',
      conversation_id: '3',
      sender_name: 'Emily Rodriguez',
      sender_avatar: 'https://i.pravatar.cc/150?u=emily',
      content: 'When will the new feature be available?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      is_outgoing: false,
    },
  ],
  4: [
    {
      id: 'm6',
      conversation_id: '4',
      sender_name: 'David Kim',
      sender_avatar: 'https://i.pravatar.cc/150?u=david',
      content: 'I would love to connect and discuss potential collaboration',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      is_outgoing: false,
    },
  ],
  5: [
    {
      id: 'm7',
      conversation_id: '5',
      sender_name: 'Lisa Anderson',
      sender_avatar: 'https://i.pravatar.cc/150?u=lisa',
      content: 'Amazing video! Keep up the great work.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      is_outgoing: false,
    },
  ],
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<'unread' | 'unresolved' | 'all'>('unread');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    const conversationMessages = mockMessages[conversation.id] || [];
    setMessages(conversationMessages);
  };

  useEffect(() => {
    // Simulate loading
    const timeoutId = setTimeout(() => {
      setConversations(mockConversations);
      if (mockConversations.length > 0 && mockConversations[0]) {
        const firstConversation = mockConversations[0];
        handleSelectConversation(firstConversation);
      }
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleSendMessage = (content: string) => {
    if (!selectedConversation) {
      return;
    }

    const newMessage: Message = {
      id: `m${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_name: 'You',
      sender_avatar: 'https://i.pravatar.cc/150?u=user',
      content,
      timestamp: new Date().toISOString(),
      is_outgoing: true,
    };

    setMessages(prev => [...prev, newMessage]);

    // Update conversation snippet
    setConversations(prev =>
      prev.map(conv =>
        conv.id === selectedConversation.id
          ? {
              ...conv,
              last_message_snippet: content,
              last_message_timestamp: new Date().toISOString(),
            }
          : conv,
      ),
    );
  };

  const filteredConversations = conversations
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => c.contact_name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="-m-6 flex h-[calc(100vh-8rem)] overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <div className="flex h-full w-[350px] flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="space-y-4 border-b border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search conversation..."
              className="pl-10"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading
            ? (
                <p className="p-4 text-center text-gray-500">Loading conversations...</p>
              )
            : (
                filteredConversations.map(convo => (
                  <ConversationItem
                    key={convo.id}
                    conversation={convo}
                    isSelected={selectedConversation?.id === convo.id}
                    onClick={() => handleSelectConversation(convo)}
                  />
                ))
              )}
        </div>
      </div>

      {/* Main Chat View */}
      <ChatView conversation={selectedConversation} messages={messages} onSendMessage={handleSendMessage} />
    </div>
  );
}
