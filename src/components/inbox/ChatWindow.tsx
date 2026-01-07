'use client';

import type { Conversation, Message } from '@/libs/meta-inbox';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Heart, MessageCircle, Paperclip, Plus, Send, Smile, Sparkles, ThumbsUp, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';
import { formatDateForDisplay, getIntlLocale } from '@/libs/timezone';

// CommentThread component for rendering nested comments
type CommentThreadProps = {
  message: Message;
  conversation: Conversation | null;
  messageLikes: Record<string, { liked: boolean; count: number }>;
  likingMessageId: string | null;
  replyingToMessage: Message | null;
  onLike: (messageId: string) => void;
  onReply: (message: Message) => void;
  locale: string;
  isRTL: boolean;
  intlLocale: string;
  accountId?: string;
  depth?: number; // Nesting depth for indentation
};

function CommentThread({
  message,
  conversation,
  messageLikes,
  likingMessageId,
  replyingToMessage,
  onLike,
  onReply,
  locale,
  isRTL,
  intlLocale,
  accountId,
  depth = 0,
}: CommentThreadProps) {
  const isOutgoing = message.isOutgoing;
  const messageDate = new Date(message.timestamp);
  const timeString = messageDate.toLocaleTimeString(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isReply = depth > 0;

  return (
    <div className={cn(
      'space-y-2',
      isReply && (isRTL ? 'pr-6 pl-0 border-r-2 border-gray-300' : 'pl-6 border-l-2 border-gray-300'),
    )}
    >
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'flex items-end gap-2',
          isRTL
            ? isOutgoing
              ? 'justify-start'
              : 'justify-end'
            : isOutgoing
              ? 'justify-end'
              : 'justify-start',
        )}
      >
        {(!isOutgoing && !isRTL) || (isOutgoing && isRTL)
          ? (
              <div className="flex-shrink-0">
                {message.senderAvatar
                  ? (
                      <>
                        <Image
                          src={message.senderAvatar}
                          alt={message.senderName}
                          width={isReply ? 24 : 32}
                          height={isReply ? 24 : 32}
                          className={cn('rounded-full object-cover', isReply ? 'h-6 w-6' : 'h-8 w-8')}
                          unoptimized={message.senderAvatar.includes('cdninstagram.com') || message.senderAvatar.includes('fbsbx.com') || message.senderAvatar.includes('fbcdn.net')}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                        <div className={cn('hidden items-center justify-center rounded-full bg-gray-200', isReply ? 'h-6 w-6' : 'h-8 w-8')}>
                          <span className={cn('font-semibold text-gray-600', isReply ? 'text-xs' : 'text-xs')}>
                            {message.senderName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </>
                    )
                  : (
                      <div className={cn('flex items-center justify-center rounded-full bg-gray-200', isReply ? 'h-6 w-6' : 'h-8 w-8')}>
                        <span className={cn('font-semibold text-gray-600', isReply ? 'text-xs' : 'text-xs')}>
                          {message.senderName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
              </div>
            )
          : null}
        <div
          className={cn(
            'max-w-md rounded-2xl px-4 py-2',
            isReply && 'max-w-sm',
            isOutgoing
              ? isRTL
                ? 'rounded-bl-sm bg-pink-500 text-white'
                : 'rounded-br-sm bg-pink-500 text-white'
              : isRTL
                ? 'rounded-br-sm bg-gray-100 text-gray-900'
                : 'rounded-bl-sm bg-gray-100 text-gray-900',
          )}
        >
          <p className={cn('break-words whitespace-pre-wrap', isReply ? 'text-xs' : 'text-sm')}>{message.content}</p>
          <div className={cn('mt-1 flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <p
              className={cn(
                isReply ? 'text-xs' : 'text-xs',
                isOutgoing ? 'text-blue-100' : 'text-gray-500',
              )}
            >
              {timeString}
            </p>
            {/* Like and Reply buttons - only show for incoming messages in comment conversations */}
            {!isOutgoing && conversation?.type === 'comment' && (
              <div className={cn('flex items-center gap-1', isRTL && 'flex-row-reverse')}>
                {/* Like button */}
                <button
                  type="button"
                  onClick={() => onLike(message.id)}
                  disabled={likingMessageId === message.id}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors',
                    messageLikes[message.id]?.liked
                      ? 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                      : 'bg-transparent text-gray-500 hover:bg-gray-200',
                    isRTL && 'flex-row-reverse',
                  )}
                  title={messageLikes[message.id]?.liked ? 'Unlike' : 'Like'}
                >
                  <Heart
                    className={cn(
                      'h-3.5 w-3.5',
                      messageLikes[message.id]?.liked && 'fill-current',
                    )}
                  />
                  {messageLikes[message.id]?.count && messageLikes[message.id]!.count > 0 && (
                    <span className="text-xs font-medium">
                      {messageLikes[message.id]!.count}
                    </span>
                  )}
                </button>
                {/* Reply button */}
                <button
                  type="button"
                  onClick={() => onReply(message)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors',
                    replyingToMessage?.id === message.id
                      ? 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                      : 'bg-transparent text-gray-500 hover:bg-gray-200',
                    isRTL && 'flex-row-reverse',
                  )}
                  title="Reply"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map(att => (
                <div key={`${att.type}-${att.url}`} className="overflow-hidden rounded-lg">
                  {att.type === 'image' && (
                    <Image
                      src={att.url}
                      alt="Attachment"
                      width={200}
                      height={200}
                      className="h-auto max-w-full rounded-lg"
                    />
                  )}
                  {att.type === 'video' && (
                    <video src={att.url} controls className="max-w-full rounded-lg">
                      <track kind="captions" />
                    </video>
                  )}
                  {att.type === 'file' && (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-pink-500 hover:underline"
                    >
                      <Paperclip className="h-4 w-4" />
                      View file
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {(isOutgoing && !isRTL) || (!isOutgoing && isRTL)
          ? (
              <div className="flex-shrink-0">
                {isOutgoing && conversation?.contactAvatar
                  ? (
                      <Image
                        src={conversation.contactAvatar}
                        alt="You"
                        width={isReply ? 24 : 32}
                        height={isReply ? 24 : 32}
                        className={cn('rounded-full object-cover', isReply ? 'h-6 w-6' : 'h-8 w-8')}
                        unoptimized={conversation.contactAvatar.includes('cdninstagram.com') || conversation.contactAvatar.includes('fbsbx.com') || conversation.contactAvatar.includes('fbcdn.net')}
                      />
                    )
                  : (
                      <div className={cn('flex items-center justify-center rounded-full bg-pink-500', isReply ? 'h-6 w-6' : 'h-8 w-8')}>
                        <span className={cn('font-semibold text-white', isReply ? 'text-xs' : 'text-xs')}>You</span>
                      </div>
                    )}
              </div>
            )
          : null}
      </motion.div>
      {/* Render nested replies */}
      {message.replies && message.replies.length > 0 && (
        <div className={cn('space-y-2 mt-2', isRTL ? 'mr-0' : 'ml-0')}>
          {message.replies.map(reply => (
            <CommentThread
              key={reply.id}
              message={reply}
              conversation={conversation}
              messageLikes={messageLikes}
              likingMessageId={likingMessageId}
              replyingToMessage={replyingToMessage}
              onLike={onLike}
              onReply={onReply}
              locale={locale}
              isRTL={isRTL}
              intlLocale={intlLocale}
              accountId={accountId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Emoji categories for emoji picker
const EMOJI_CATEGORIES = {
  'Smileys & People': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'],
  'Animals & Nature': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔'],
  'Food & Drink': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'],
  'Travel & Places': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩', '🛫', '🛬', '🪂', '💺', '🚢', '⛵️', '🚤', '🛥', '🛳', '⛴', '🚀', '🛰', '🛸', '🛎', '🧳', '⌛️', '⏳', '⌚️', '⏰', '⏱', '⏲', '🕰', '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', '🕡', '🕖', '🕢', '🕗', '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', '🕦'],
  'Activities': ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳️', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩'],
  'Objects': ['⌚️', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '⏱', '⏲', '⏰', '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒', '🛠', '⛏', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎', '🔑', '🗝', '🚪', '🪑', '🛋', '🛏', '🛌', '🧸', '🪆', '🖼', '🪞', '🪟', '🛍', '🛒', '🎁', '🎈', '🎉', '🎊', '🎀', '🎗', '🎟', '🎫', '🎪', '🪅', '🪩', '🎭', '🩰', '🎨', '🖼', '🎰', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🚚', '🚛', '🚜', '🏎', '🏍', '🛵', '🦽', '🦼', '🛴', '🚲', '🛺', '🚁', '✈️', '🛩', '🛫', '🛬', '🪂', '💺', '🚢', '⛵️', '🚤', '🛥', '🛳', '⛴', '🚀', '🛸', '🛰', '🛎', '🧳'],
  'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❓', '❕', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯️', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿️', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🔢', '🔟'],
} as const;

// Quick reply templates
const QUICK_REPLIES = [
  { text: 'Thank you for your message!', icon: Heart },
  { text: 'I\'ll get back to you shortly.', icon: Clock },
  { text: 'Thanks for reaching out!', icon: MessageCircle },
  { text: 'We appreciate your feedback!', icon: ThumbsUp },
  { text: 'Let me help you with that.', icon: MessageCircle },
] as const;

type ChatWindowProps = {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (message: string, mentionUserId?: string, mentionName?: string, replyToCommentId?: string) => Promise<void>;
  locale: string;
  isLoading?: boolean;
  accountId?: string; // Database account ID (UUID) for API calls
};

export function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  locale,
  isLoading = false,
  accountId,
}: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ type: 'image' | 'file'; url: string; file: File }>>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [messageLikes, setMessageLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [likingMessageId, setLikingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Inbox');
  const intlLocale = getIntlLocale(locale);
  const isRTL = locale === 'he';

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch like counts for all messages when they change
  useEffect(() => {
    if (!conversation || messages.length === 0) {
      return;
    }

    const fetchLikes = async () => {
      // Only fetch likes for comment conversations
      if (conversation?.type !== 'comment' || !accountId || !conversation?.platform) {
        return;
      }

      const likesPromises = messages
        .filter(msg => !msg.isOutgoing) // Only fetch likes for incoming messages
        .map(async (msg) => {
          try {
            const params = new URLSearchParams({
              commentId: msg.id,
              accountId,
              platform: conversation.platform,
            });
            const response = await fetch(`/api/inbox/comments/like?${params.toString()}`);
            if (response.ok) {
              const data = await response.json();
              return { messageId: msg.id, ...data };
            }
          } catch (error) {
            console.error(`Error fetching likes for message ${msg.id}:`, error);
          }
          return { messageId: msg.id, liked: false, count: 0 };
        });

      const likesResults = await Promise.all(likesPromises);
      const likesMap: Record<string, { liked: boolean; count: number }> = {};
      likesResults.forEach((result) => {
        likesMap[result.messageId] = { liked: result.liked, count: result.count };
      });
      setMessageLikes(likesMap);
    };

    fetchLikes();
  }, [messages, conversation, accountId]);

  // Close emoji picker and plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Insert emoji at cursor position
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = newMessage;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setNewMessage(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setNewMessage(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target?.files || []);
    if (files.length === 0) {
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      for (const file of files) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          // File too large - skip it
          console.error(`File ${file.name} is too large. Maximum size is 10MB.`);
          continue;
        }

        // Determine file type
        const isImage = file.type.startsWith('image/');
        const type = isImage ? 'image' : 'file';

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/inbox/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName);

        setAttachments(prev => [...prev, { type, url: publicUrl, file }]);
      }

      // Reset input
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Insert quick reply template
  const insertQuickReply = (text: string) => {
    setNewMessage(text);
    setShowPlusMenu(false);
    // Focus textarea after inserting
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(text.length, text.length);
    }, 0);
  };

  // Generate AI response - improve existing text or suggest new reply
  const generateAIResponse = async () => {
    if (!conversation || isGeneratingAI) {
      return;
    }

    setIsGeneratingAI(true);
    try {
      const hasExistingText = newMessage.trim().length > 0;
      const conversationContext = messages.slice(-5).map(m => `${m.isOutgoing ? 'You' : conversation.contactName}: ${m.content}`).join('\n');

      // Call AI API to improve or generate a response
      const response = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          platform: conversation.platform,
          context: conversationContext,
          existingMessage: hasExistingText ? newMessage.trim() : undefined,
          mode: hasExistingText ? 'improve' : 'suggest',
          conversationType: conversation.type, // 'chat' or 'comment'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.reply) {
          setNewMessage(data.reply);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('AI generation error:', errorData.error || 'Failed to generate response');
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSend = async () => {
    const messageText = newMessage.trim();
    if ((!messageText && attachments.length === 0) || isSending || !conversation) {
      return;
    }

    setIsSending(true);
    try {
      // For comment conversations, automatically add mention
      const messageToSend = messageText;
      let mentionUserId: string | undefined;
      let mentionName: string | undefined;

      if (conversation.type === 'comment' && messages.length > 0) {
        // If replying to a specific message, use that message's sender
        if (replyingToMessage && replyingToMessage.senderId && replyingToMessage.senderName) {
          mentionUserId = replyingToMessage.senderId;
          mentionName = replyingToMessage.senderName;
        } else {
          // Otherwise, find the original comment (first incoming message)
          const originalComment = messages.find(msg => !msg.isOutgoing);
          if (originalComment && originalComment.senderId && originalComment.senderName) {
            mentionUserId = originalComment.senderId;
            mentionName = originalComment.senderName;
          } else if (conversation.contactName) {
            // Fallback to conversation contact name if we don't have sender info
            mentionName = conversation.contactName;
          }
        }
      }

      // Determine which comment to reply to
      // If replying to a specific message, use that message's ID
      // Otherwise, reply to the post (create new top-level comment)
      const replyToCommentId = replyingToMessage?.id;

      // For now, send text only. Attachments can be added later via API
      if (messageToSend) {
        await onSendMessage(messageToSend, mentionUserId, mentionName, replyToCommentId);
      }
      setNewMessage('');
      setAttachments([]);
      setShowEmojiPicker(false);
      setShowPlusMenu(false);
      setReplyingToMessage(null); // Clear reply target after sending
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle like/unlike a comment
  const handleLike = async (messageId: string) => {
    if (!conversation || !accountId || likingMessageId) {
      return;
    }

    setLikingMessageId(messageId);
    try {
      const response = await fetch('/api/inbox/comments/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: messageId,
          accountId,
          platform: conversation.platform,
          conversationId: conversation.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessageLikes(prev => ({
          ...prev,
          [messageId]: {
            liked: data.liked,
            count: data.count || 0,
          },
        }));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLikingMessageId(null);
    }
  };

  // Handle reply to a specific comment
  const handleReplyToComment = (message: Message) => {
    if (!message.senderName || !conversation) {
      return;
    }

    // Set the message being replied to
    setReplyingToMessage(message);

    // Focus the textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <p className={cn('text-gray-500', isRTL && 'text-right')}>{t('select_comment')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Comment Header */}
      <div className={cn('flex items-center justify-between border-b border-gray-200 px-6 py-4', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
          {conversation.contactAvatar
            ? (
                <>
                  <Image
                    src={conversation.contactAvatar}
                    alt={conversation.contactName}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                    unoptimized={conversation.contactAvatar.includes('cdninstagram.com') || conversation.contactAvatar.includes('fbsbx.com') || conversation.contactAvatar.includes('fbcdn.net')}
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
                  <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                    <span className="text-sm font-semibold text-gray-600">
                      {conversation.contactName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </>
              )
            : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                  <span className="text-sm font-semibold text-gray-600">
                    {conversation.contactName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{conversation.contactName}</h2>
            <p className={cn('text-sm text-gray-500 capitalize', isRTL && 'text-right')}>
              {conversation.type === 'chat' ? t('private_message') : t('comment')}
              {' '}
              •
              {conversation.platform}
            </p>
          </div>
        </div>
      </div>

      {/* Post Context (for comments) */}
      {conversation.type === 'comment' && conversation.postContent && (
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex gap-3">
            {conversation.postImageUrl && (
              <Image
                src={conversation.postImageUrl}
                alt="Post"
                width={60}
                height={60}
                className="h-15 w-15 rounded object-cover"
              />
            )}
            <div className="flex-1">
              <p className="line-clamp-2 text-sm text-gray-900">{conversation.postContent}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDateForDisplay(conversation.lastMessageTime, { locale, format: 'short' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading
          ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-pink-500" />
                  <p className={cn('text-sm text-gray-500', isRTL && 'text-right')}>{t('loading_messages')}</p>
                </div>
              </div>
            )
          : messages.length === 0
            ? (
                <div className="flex h-full items-center justify-center">
                  <p className={cn('text-gray-500', isRTL && 'text-right')}>{t('no_messages')}</p>
                </div>
              )
            : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {messages.map((message) => {
                      // Render message and its nested replies recursively
                      return (
                        <CommentThread
                          key={message.id}
                          message={message}
                          conversation={conversation}
                          messageLikes={messageLikes}
                          likingMessageId={likingMessageId}
                          replyingToMessage={replyingToMessage}
                          onLike={handleLike}
                          onReply={handleReplyToComment}
                          locale={locale}
                          isRTL={isRTL}
                          intlLocale={intlLocale}
                          accountId={accountId}
                        />
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        {/* Reply indicator */}
        {replyingToMessage && conversation?.type === 'comment' && (
          <div className={cn('mb-2 flex items-center justify-between rounded-lg bg-pink-50 border border-pink-200 px-3 py-2', isRTL && 'flex-row-reverse')}>
            <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <MessageCircle className="h-4 w-4 text-pink-600" />
              <span className={cn('text-sm text-pink-700', isRTL && 'text-right')}>
                Replying to
                {' '}
                <span className="font-semibold">{replyingToMessage.senderName}</span>
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-pink-600 hover:bg-pink-100"
              onClick={() => setReplyingToMessage(null)}
              title="Cancel reply"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map(att => (
              <div key={`${att.type}-${att.url}`} className="relative">
                {att.type === 'image'
                  ? (
                      <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                        <Image
                          src={att.url}
                          alt="Attachment"
                          fill
                          className="object-cover"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 p-0 text-white hover:bg-red-600"
                          onClick={() => removeAttachment(attachments.indexOf(att))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  : (
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <Paperclip className="h-4 w-4 text-gray-600" />
                        <span className="max-w-[100px] truncate text-xs text-gray-700">{att.file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 text-gray-500 hover:text-red-500"
                          onClick={() => removeAttachment(attachments.indexOf(att))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handleFileUpload}
              multiple
            />

            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder={t('write_message')}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className={cn('min-h-[60px] resize-none bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:bg-white focus-visible:border-pink-300 focus-visible:ring-pink-500', isRTL ? 'pl-20' : 'pr-20')}
                disabled={isSending}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <div className={cn('absolute bottom-2 flex items-center gap-1', isRTL ? 'left-2' : 'right-2')}>
                {/* Emoji Picker Button */}
                <div className="relative" ref={emojiPickerRef}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${showEmojiPicker ? 'bg-pink-100 text-pink-600' : 'text-gray-400 hover:text-gray-600'}`}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div className={cn('absolute bottom-full mb-2 w-[320px] rounded-lg border border-gray-200 bg-white shadow-lg z-50 p-3', isRTL ? 'left-0' : 'right-0')}>
                      <div className="mb-2 flex gap-1 overflow-x-auto border-b border-gray-200 pb-2">
                        {Object.keys(EMOJI_CATEGORIES).map(category => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => {}}
                            className="rounded px-2 py-1 text-xs font-medium whitespace-nowrap text-gray-600 hover:bg-gray-100"
                          >
                            {category.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <div className="grid grid-cols-8 gap-1">
                          {EMOJI_CATEGORIES['Smileys & People'].slice(0, 48).map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => insertEmoji(emoji)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-pink-100"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* File/Image Upload Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-gray-600"
                  onClick={() => fileInputRef.current?.click()}
                  title={t('attach_file')}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* Plus Menu Button */}
                <div className="relative" ref={plusMenuRef}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${showPlusMenu ? 'bg-pink-100 text-pink-600' : 'text-gray-400 hover:text-gray-600'}`}
                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {/* Plus Menu - Quick Replies */}
                  {showPlusMenu && (
                    <div className={cn('absolute bottom-full mb-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-50 py-2', isRTL ? 'left-0' : 'right-0')} dir={isRTL ? 'rtl' : 'ltr'}>
                      <div className={cn('px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide', isRTL && 'text-right')}>
                        {t('quick_replies')}
                      </div>
                      {QUICK_REPLIES.map((reply, index) => {
                        const Icon = reply.icon;
                        const replyKeys: Array<'thank_you_message' | 'will_get_back' | 'thanks_reaching_out' | 'appreciate_feedback' | 'let_me_help'> = ['thank_you_message', 'will_get_back', 'thanks_reaching_out', 'appreciate_feedback', 'let_me_help'];
                        const replyKey = replyKeys[index];
                        if (!replyKey) {
                          return null;
                        }
                        return (
                          <button
                            key={replyKey}
                            type="button"
                            className={cn('w-full px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 flex items-center gap-3 transition-colors', isRTL ? 'text-right flex-row-reverse' : 'text-left')}
                            onClick={() => insertQuickReply(t(replyKey))}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                            <span className="truncate">{t(replyKey)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* AI Generate/Improve Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${isGeneratingAI ? 'text-pink-600' : 'text-gray-400 hover:text-gray-600'}`}
                  onClick={generateAIResponse}
                  disabled={isGeneratingAI || !conversation}
                  title={newMessage.trim() ? t('improve_message') : t('suggest_reply')}
                >
                  {isGeneratingAI
                    ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
                      )
                    : (
                        <Sparkles className="h-4 w-4" />
                      )}
                </Button>
              </div>
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={(!newMessage.trim() && attachments.length === 0) || isSending}
            className="h-[60px] w-[60px] rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300"
            size="icon"
          >
            {isSending
              ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )
              : (
                  <Send className="h-5 w-5 text-white" />
                )}
          </Button>
        </div>
      </div>
    </div>
  );
}
