'use client';

import {
  AlertCircle,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Globe,
  Hash,
  Image as ImageIcon,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Pencil,
  Play,
  RefreshCcw,
  Share2,
  Smartphone,
  Smile,
  ThumbsUp,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useBrand } from '@/contexts/BrandContext';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';
import { localToUtc } from '@/libs/timezone';

export const dynamic = 'force-dynamic';

type Platform = 'instagram' | 'x' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'threads';
type Format = 'feed' | 'story' | 'reel' | 'post' | 'short' | 'video' | 'carousel' | 'thread' | 'pin' | 'link';

type Variant = {
  id: string;
  platform: Platform;
  format: Format;
  caption: string;
  syncWithBase: boolean;
};

type AiSuggestionType = 'caption' | 'title' | 'body' | 'hashtags' | 'optimization' | 'all';

type Account = {
  id: string;
  brand_id: string;
  platform: Platform;
  account_name: string;
  getlate_account_id?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
};

// Custom icon components matching the design
const InstagramIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const XIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const YouTubeIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const TikTokIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const ThreadsIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const PLATFORM_ICON_CONFIG = {
  instagram: { icon: InstagramIcon, color: 'text-white', bg: 'bg-pink-500', name: 'Instagram' },
  x: { icon: XIcon, color: 'text-white', bg: 'bg-pink-500', name: 'X (Twitter)' },
  facebook: { icon: FacebookIcon, color: 'text-white', bg: 'bg-pink-500', name: 'Facebook' },
  linkedin: { icon: LinkedInIcon, color: 'text-white', bg: 'bg-pink-500', name: 'LinkedIn' },
  youtube: { icon: YouTubeIcon, color: 'text-white', bg: 'bg-pink-500', name: 'YouTube' },
  tiktok: { icon: TikTokIcon, color: 'text-white', bg: 'bg-pink-500', name: 'TikTok' },
  threads: { icon: ThreadsIcon, color: 'text-white', bg: 'bg-pink-500', name: 'Threads' },
} as const;

// Default formats based on Getlate API documentation: https://docs.getlate.dev
// These will be overridden by Getlate API data when available
const DEFAULT_PLATFORM_FORMATS: Record<Platform, Format[]> = {
  instagram: ['feed', 'story', 'reel', 'carousel'], // Feed posts, Stories, Reels, Carousels (up to 10 items)
  x: ['post', 'thread'], // Text, images, videos, threads (multi-post)
  facebook: ['feed', 'story', 'video'], // Page posts, Stories (24-hour ephemeral), videos, multi-image posts (up to 10) - NO REELS
  linkedin: ['post'], // Posts with up to 20 images, single video, single PDF document, GIFs, link previews
  youtube: ['video', 'short'], // Videos only (≤3 min = Shorts, >3 min = regular)
  tiktok: ['video', 'carousel'], // Videos, photo carousels (up to 35 images, no mixing photos/videos)
  threads: ['feed', 'story'], // Text posts, images, videos (5 min max), thread sequences - NO REELS
};

const FORMAT_LABELS: Record<Format, string> = {
  feed: 'Feed Post', // Main timeline posts (Instagram/Facebook/Threads)
  story: 'Story', // 24-hour ephemeral content
  reel: 'Reel', // Short-form video (Instagram only)
  post: 'Post', // Main timeline posts (X/LinkedIn)
  short: 'Short', // Short-form video (YouTube ≤3 min)
  video: 'Video', // Regular video content
  carousel: 'Carousel', // Multi-image/video posts
  thread: 'Thread', // Multi-post sequences (Twitter/X)
  pin: 'Pin', // Pinterest single image or video
  link: 'Link Post', // Link posts (Reddit)
};

// Formats that require media to be uploaded
const FORMAT_REQUIRES_MEDIA: Record<Format, boolean> = {
  feed: false, // Can be text-only
  story: true, // Stories require media
  reel: true, // Reels require video
  post: false, // Can be text-only
  short: true, // Shorts require video
  video: true, // Videos require video media
  carousel: true, // Carousels require multiple media items
  thread: false, // Can be text-only
  pin: true, // Pins require media
  link: false, // Can be text-only
};

// Formats that require specific media types
const FORMAT_REQUIRES_VIDEO: Format[] = ['reel', 'short', 'video'];
const FORMAT_REQUIRES_MULTIPLE_MEDIA: Format[] = ['carousel'];
const FORMAT_MIN_MEDIA_COUNT: Record<Format, number> = {
  feed: 0,
  story: 1,
  reel: 1, // Video required
  post: 0,
  short: 1, // Video required
  video: 1, // Video required
  carousel: 2, // At least 2 items for carousel
  thread: 0,
  pin: 1,
  link: 0,
};

// Maximum media counts per format (based on Getlate API limits)
const FORMAT_MAX_MEDIA_COUNT: Record<Format, number> = {
  feed: 1, // Single image/video
  story: 1, // Single image/video
  reel: 1, // Single video
  post: 4, // X/Twitter allows up to 4 images
  short: 1, // Single video
  video: 1, // Single video
  carousel: 10, // Instagram/Facebook: up to 10, TikTok: up to 35
  thread: 4, // X/Twitter thread: up to 4 images per post
  pin: 1, // Single image or video
  link: 0, // No media
};

const PLATFORM_CHARACTER_LIMITS: Record<Platform, number> = {
  instagram: 2200,
  x: 280,
  facebook: 63206,
  linkedin: 3000,
  youtube: 5000,
  tiktok: 4000,
  threads: 280,
};

const TONE_OPTIONS = ['Friendly', 'Professional', 'Bold', 'Playful', 'Educational'];

const randomId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

// Common emojis organized by category
const EMOJI_CATEGORIES = {
  'Smileys & People': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
  'Gestures': ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃'],
  'Objects': ['💎', '🔔', '🎵', '🎶', '💰', '💳', '💎', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '✈️', '🛩', '🛫', '🛬', '🪂', '💺', '🚀', '🛸', '🚉', '🚊', '🚝', '🚞', '🚋', '🚃', '🚟', '🚠', '🚡', '⛵', '🛶', '🚤', '🛥', '🛳', '⛴', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟', '🎡', '🎢', '🎠', '⛲', '⛱', '🏖', '🏝', '🏜', '🌋', '⛰', '🏔', '🗻', '🏕', '⛺', '🏠', '🏡', '🏘', '🏚', '🏗', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩', '🛤', '🛣', '🗾', '🎑', '🏞', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙', '🌃', '🌌', '🌉', '🌁'],
  'Food & Drink': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾', '🥄', '🍴', '🍽', '🥣', '🥡', '🥢'],
  'Animals & Nature': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🐈', '🦮', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🦅', '🦆', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🐈', '🦮', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊'],
  'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🔢', '🔟', '🔢', '🔣', '🔤', '🔡', '🔠', '🔢', '🔟'],
};

// Emoji Picker Component
function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const categoryKeys = Object.keys(EMOJI_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState<string>(categoryKeys[0] || 'Smileys & People');

  return (
    <div className="w-full">
      {/* Category Tabs */}
      <div className="mb-2 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {Object.keys(EMOJI_CATEGORIES).map(category => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              'whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors',
              activeCategory === category
                ? 'bg-pink-100 text-pink-700'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {category.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="max-h-[300px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES]?.map(emoji => (
            <button
              key={`${activeCategory}-${emoji}`}
              type="button"
              onClick={() => onSelect(emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-pink-100 hover:text-pink-700"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Avatar component with fallback to platform icon
function AvatarComponent({
  platform,
  accounts,
  size = 32,
  className = '',
}: {
  platform: Platform;
  accounts: Array<{ platform: Platform; display_name?: string | null; account_name?: string | null; avatar_url?: string | null }>;
  size?: number;
  className?: string;
}) {
  const platformAccount = accounts.find(acc => acc.platform === platform);
  const accountName = platformAccount?.display_name || platformAccount?.account_name || 'username';
  const avatarUrl = platformAccount?.avatar_url;
  const config = PLATFORM_ICON_CONFIG[platform];
  const PlatformIcon = config.icon;
  const [imageError, setImageError] = useState(false);

  if (!avatarUrl || imageError) {
    return (
      <div className={cn('rounded-full flex items-center justify-center', config.bg, className)} style={{ width: size, height: size }}>
        <PlatformIcon className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  return (
    <div className={cn('rounded-full overflow-hidden', className)} style={{ width: size, height: size }}>
      <Image
        src={avatarUrl}
        alt={accountName}
        width={size}
        height={size}
        className="object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

// PreviewCard component for platform-specific post previews
function PreviewCard({
  platform,
  accounts,
  variants,
  platformFormats,
  platformContent,
  baseCaption,
  postTitle,
  mainLink,
  mediaUrls,
  previewDevice,
  t,
}: {
  platform: Platform;
  accounts: Array<{ platform: Platform; display_name?: string | null; account_name?: string | null; avatar_url?: string | null }>;
  variants: Array<{ platform: Platform; format: Format }>;
  platformFormats: Record<Platform, Format[]>;
  platformContent: Record<Platform, { caption: string; title: string; link: string; mediaUrls: string[]; hashtags: string[] }>;
  baseCaption: string;
  postTitle: string;
  mainLink: string;
  mediaUrls: string[];
  previewDevice: 'mobile' | 'desktop';
  t: ReturnType<typeof useTranslations>;
}) {
  const locale = useLocale();
  const isRTL = locale === 'he';
  const platformVariants = variants.filter(v => v.platform === platform);
  const format = platformVariants[0]?.format || (platformFormats[platform]?.[0] || 'post');
  const platformContentData = platformContent[platform] || { caption: baseCaption, title: postTitle, link: mainLink, mediaUrls: [], hashtags: [] };
  const previewLink = platformContentData.link || mainLink;

  // If link exists, add note to caption about link being in first comment
  let previewCaption = platformContentData.caption || baseCaption;
  if (previewLink && previewLink.trim()) {
    const linkNote = isRTL
      ? '🔗 הקישור נוסף בתגובה הראשונה'
      : '🔗 Link is added in the first comment';
    // Only add note if not already present
    if (!previewCaption.includes('first comment') && !previewCaption.includes('תגובה הראשונה')) {
      previewCaption = `${previewCaption}\n\n${linkNote}`;
    }
  }

  const previewTitle = platformContentData.title || postTitle;
  const previewMediaUrls = platformContentData.mediaUrls.length > 0 ? platformContentData.mediaUrls : mediaUrls;
  const previewHashtags = platformContentData.hashtags || [];

  // Get account info for this platform
  const platformAccount = accounts.find(acc => acc.platform === platform);
  const accountName = platformAccount?.display_name || platformAccount?.account_name || 'username';

  // Platform-specific preview rendering
  if (platform === 'instagram') {
    if (format === 'story') {
      // Instagram Story - Full screen, 9:16 aspect ratio
      return (
        <div className={cn(
          'relative mx-auto overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500',
          previewDevice === 'mobile' ? 'h-[600px] w-[337px]' : 'h-[500px] w-[281px]',
        )}
        >
          {/* Story Header */}
          <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <div className="border-2 border-white">
                <AvatarComponent platform={platform} accounts={accounts} size={32} />
              </div>
              <span className="text-sm font-semibold text-white">{accountName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              <MoreHorizontal className="h-5 w-5 text-white" />
            </div>
          </div>

          {/* Story Content */}
          <div className="flex h-full flex-col items-center justify-center p-4 pt-16">
            {previewMediaUrls[0]
              ? (
                  <div className="relative h-full w-full">
                    <Image src={previewMediaUrls[0]} alt="Story" fill className="object-cover" />
                    {previewTitle && (
                      <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                        <p className="text-center text-lg font-bold text-white drop-shadow-lg">{previewTitle}</p>
                      </div>
                    )}
                  </div>
                )
              : (
                  <div className="text-center">
                    {previewTitle && (
                      <p className="mb-2 text-xl font-bold text-white">{previewTitle}</p>
                    )}
                    <p className="text-lg font-medium text-white">{previewCaption || 'Your story'}</p>
                  </div>
                )}
          </div>

          {/* Story Footer */}
          <div className="absolute right-0 bottom-0 left-0 z-10 flex items-center justify-center gap-4 p-4">
            <button type="button" className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
              <MessageCircle className="h-5 w-5 text-white" />
            </button>
            <button type="button" className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
              <Share2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      );
    } else if (format === 'reel') {
      // Instagram Reel - Vertical video format
      return (
        <div className={cn(
          'relative mx-auto overflow-hidden rounded-lg bg-black',
          previewDevice === 'mobile' ? 'h-[600px] w-[337px]' : 'h-[500px] w-[281px]',
        )}
        >
          {/* Reel Header */}
          <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <div className="border-2 border-white">
                <AvatarComponent platform={platform} accounts={accounts} size={32} />
              </div>
              <span className="text-sm font-semibold text-white">{accountName}</span>
            </div>
            <MoreHorizontal className="h-5 w-5 text-white" />
          </div>

          {/* Reel Content */}
          <div className="flex h-full items-center justify-center">
            {previewMediaUrls[0]
              ? (
                  <div className="relative h-full w-full">
                    <Image src={previewMediaUrls[0]} alt="Reel" fill className="object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="h-16 w-16 rounded-full bg-black/50 p-4 text-white" />
                    </div>
                  </div>
                )
              : (
                  <div className="text-center text-white">
                    <Play className="mx-auto h-16 w-16" />
                    <p className="mt-2 text-sm">{previewCaption || 'Your reel'}</p>
                  </div>
                )}
          </div>

          {/* Reel Footer - Right side */}
          <div className="absolute right-0 bottom-0 z-10 flex flex-col gap-4 p-4">
            <button type="button" className="flex flex-col items-center gap-1">
              <ThumbsUp className="h-6 w-6 text-white" />
              <span className="text-xs text-white">1.2K</span>
            </button>
            <button type="button" className="flex flex-col items-center gap-1">
              <MessageCircle className="h-6 w-6 text-white" />
              <span className="text-xs text-white">234</span>
            </button>
            <button type="button" className="flex flex-col items-center gap-1">
              <Share2 className="h-6 w-6 text-white" />
              <span className="text-xs text-white">Share</span>
            </button>
          </div>

          {/* Caption overlay */}
          {(previewTitle || previewCaption) && (
            <div className="absolute right-0 bottom-0 left-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
              {previewTitle && (
                <p className="mb-1 text-sm font-semibold text-white">{previewTitle}</p>
              )}
              {previewCaption && (
                <p className="line-clamp-2 text-sm text-white">{previewCaption}</p>
              )}
            </div>
          )}
        </div>
      );
    } else {
      // Instagram Feed Post
      return (
        <div className={cn(
          'mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white',
          previewDevice === 'mobile' ? 'max-w-sm' : '',
        )}
        >
          {/* Profile Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 p-3">
            <AvatarComponent platform={platform} accounts={accounts} size={32} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{accountName}</p>
            </div>
            <MoreHorizontal className="h-5 w-5 text-slate-600" />
          </div>

          {/* Media */}
          {previewMediaUrls[0] && (
            <div className="relative aspect-square w-full bg-slate-100">
              <Image src={previewMediaUrls[0]} alt="Post" fill className="object-cover" />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 p-3">
            <ThumbsUp className="h-6 w-6 text-slate-900" />
            <MessageCircle className="h-6 w-6 text-slate-900" />
            <Share2 className="h-6 w-6 text-slate-900" />
            <div className="ml-auto">
              <Bookmark className="h-6 w-6 text-slate-900" />
            </div>
          </div>

          {/* Title */}
          {previewTitle && (
            <div className="px-3 pt-2">
              <h3 className="text-base font-semibold text-slate-900">{previewTitle}</h3>
            </div>
          )}
          {/* Caption */}
          {previewCaption && (
            <div className="px-3 pb-2">
              <p className="text-sm text-slate-900">
                <span className="font-semibold">{accountName}</span>
                {' '}
                {previewCaption}
              </p>
              {previewHashtags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {previewHashtags.slice(0, 5).map(tag => (
                    <span key={tag} className="text-sm text-blue-600">
                      #
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
  } else if (platform === 'x' || platform === 'threads') {
    // X/Twitter or Threads - Text-focused with media
    return (
      <div className={cn(
        'mx-auto border-b border-slate-200 bg-white',
        previewDevice === 'mobile' ? 'max-w-sm' : '',
      )}
      >
        <div className="p-4">
          {/* Profile Header */}
          <div className="mb-3 flex items-start gap-3">
            <AvatarComponent platform={platform} accounts={accounts} size={40} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{accountName}</span>
                <span className="text-sm text-slate-500">
                  @
                  {platformAccount?.account_name || 'username'}
                </span>
                <span className="text-sm text-slate-500">·</span>
                <span className="text-sm text-slate-500">2h</span>
              </div>
              {previewTitle && (
                <h3 className="mt-1 text-base font-semibold text-slate-900">{previewTitle}</h3>
              )}
              <p className="mt-1 text-sm whitespace-pre-wrap text-slate-900">
                {previewCaption || t('preview_empty')}
              </p>
              {previewHashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {previewHashtags.slice(0, 5).map(tag => (
                    <span key={tag} className="text-sm text-blue-500">
                      #
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {previewMediaUrls[0] && (
                <div className="mt-3 overflow-hidden rounded-2xl bg-slate-100">
                  <div className="relative aspect-video w-full">
                    <Image src={previewMediaUrls[0]} alt="Media" fill className="object-cover" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between text-slate-500">
            <button type="button" className="flex items-center gap-2 hover:text-blue-500">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{previewLink ? '1' : '12'}</span>
            </button>
            <button type="button" className="flex items-center gap-2 hover:text-green-500">
              <RefreshCcw className="h-4 w-4" />
              <span className="text-xs">5</span>
            </button>
            <button type="button" className="flex items-center gap-2 hover:text-pink-500">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-xs">234</span>
            </button>
            <button type="button" className="flex items-center gap-2 hover:text-blue-500">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  } else if (platform === 'facebook') {
    if (format === 'story') {
      // Facebook Story
      return (
        <div className={cn(
          'relative mx-auto overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500',
          previewDevice === 'mobile' ? 'h-[600px] w-[337px]' : 'h-[500px] w-[281px]',
        )}
        >
          <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <div className="border-2 border-white">
                <AvatarComponent platform={platform} accounts={accounts} size={32} />
              </div>
              <span className="text-sm font-semibold text-white">{accountName}</span>
            </div>
            <MoreHorizontal className="h-5 w-5 text-white" />
          </div>
          <div className="flex h-full items-center justify-center p-4 pt-16">
            {previewMediaUrls[0]
              ? (
                  <div className="relative h-full w-full">
                    <Image src={previewMediaUrls[0]} alt="Story" fill className="object-cover" />
                    {previewTitle && (
                      <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                        <p className="text-center text-lg font-bold text-white drop-shadow-lg">{previewTitle}</p>
                      </div>
                    )}
                  </div>
                )
              : (
                  <div className="text-center">
                    {previewTitle && (
                      <p className="mb-2 text-xl font-bold text-white">{previewTitle}</p>
                    )}
                    <p className="text-lg font-medium text-white">{previewCaption || 'Your story'}</p>
                  </div>
                )}
          </div>
        </div>
      );
    } else {
      // Facebook Feed Post
      return (
        <div className={cn(
          'mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
          previewDevice === 'mobile' ? 'max-w-sm' : '',
        )}
        >
          {/* Profile Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 p-3">
            <AvatarComponent platform={platform} accounts={accounts} size={40} />
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{accountName}</p>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}</span>
                <Globe className="h-3 w-3" />
              </div>
            </div>
            <MoreHorizontal className="h-5 w-5 text-slate-400" />
          </div>

          {/* Content */}
          <div className="p-3">
            {previewTitle && (
              <h3 className="mb-2 text-base font-semibold text-slate-900">{previewTitle}</h3>
            )}
            <p className="text-sm whitespace-pre-wrap text-slate-900">
              {previewCaption || t('preview_empty')}
            </p>
            {previewMediaUrls[0] && (
              <div className="mt-3 overflow-hidden rounded-lg bg-slate-100">
                <div className="relative aspect-video w-full">
                  <Image src={previewMediaUrls[0]} alt="Media" fill className="object-cover" />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-around border-t border-slate-100 p-2">
            <button type="button" className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <ThumbsUp className="h-4 w-4" />
              <span>Like</span>
            </button>
            <button type="button" className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <MessageCircle className="h-4 w-4" />
              <span>Comment</span>
            </button>
            <button type="button" className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>
          </div>
        </div>
      );
    }
  } else if (platform === 'linkedin') {
    // LinkedIn Post
    return (
      <div className={cn(
        'mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
        previewDevice === 'mobile' ? 'max-w-sm' : '',
      )}
      >
        {/* Profile Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <AvatarComponent platform={platform} accounts={accounts} size={48} />
          <div className="flex-1">
            <p className="font-semibold text-slate-900">{accountName}</p>
            <p className="text-xs text-slate-500">Software Developer · 2h</p>
          </div>
          <MoreHorizontal className="h-5 w-5 text-slate-400" />
        </div>

        {/* Content */}
        <div className="p-4">
          {previewTitle && (
            <h3 className="mb-2 text-lg font-semibold text-slate-900">{previewTitle}</h3>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-900">
            {previewCaption || t('preview_empty')}
          </p>
          {previewMediaUrls[0] && (
            <div className="mt-3 overflow-hidden rounded-lg bg-slate-100">
              <div className="relative aspect-video w-full">
                <Image src={previewMediaUrls[0]} alt="Media" fill className="object-cover" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-around border-t border-slate-100 p-2">
          <button type="button" className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <ThumbsUp className="h-4 w-4" />
            <span>Like</span>
          </button>
          <button type="button" className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <MessageCircle className="h-4 w-4" />
            <span>{previewLink ? '1' : 'Comment'}</span>
          </button>
          <button type="button" className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
        </div>

        {/* First Comment - Show link as first comment */}
        {previewLink && (
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-start gap-3">
              <AvatarComponent platform={platform} accounts={accounts} size={32} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{accountName}</span>
                  <span className="text-xs text-slate-400">now</span>
                </div>
                <p className="text-sm break-all text-blue-600">{previewLink}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } else if (platform === 'youtube') {
    // YouTube Video/Short
    return (
      <div className={cn(
        'mx-auto overflow-hidden rounded-lg bg-white',
        previewDevice === 'mobile' ? 'max-w-sm' : '',
      )}
      >
        {format === 'short'
          ? (
              // YouTube Short - Vertical
              <div className="relative h-[600px] w-[337px] bg-black">
                {previewMediaUrls[0]
                  ? (
                      <div className="relative h-full w-full">
                        <Image src={previewMediaUrls[0]} alt="Short" fill className="object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="h-16 w-16 rounded-full bg-red-600/80 p-4 text-white" />
                        </div>
                      </div>
                    )
                  : (
                      <div className="flex h-full items-center justify-center text-white">
                        <Play className="h-16 w-16" />
                      </div>
                    )}
                <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-sm font-semibold text-white">{previewTitle || 'Your Short'}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-white/80">{previewCaption}</p>
                </div>
              </div>
            )
          : (
              // YouTube Video - Horizontal
              <div>
                <div className="relative aspect-video w-full bg-black">
                  {previewMediaUrls[0]
                    ? (
                        <>
                          <Image src={previewMediaUrls[0]} alt="Video" fill className="object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="h-16 w-16 rounded-full bg-red-600/80 p-4 text-white" />
                          </div>
                        </>
                      )
                    : (
                        <div className="flex h-full items-center justify-center text-white">
                          <Play className="h-16 w-16" />
                        </div>
                      )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-slate-900">{previewTitle || 'Your Video'}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{previewCaption}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span>1.2K views</span>
                    <span>2 hours ago</span>
                  </div>
                </div>
              </div>
            )}
      </div>
    );
  } else if (platform === 'tiktok') {
    // TikTok Video
    return (
      <div className={cn(
        'relative mx-auto overflow-hidden bg-black',
        previewDevice === 'mobile' ? 'h-[600px] w-[337px]' : 'h-[500px] w-[281px]',
      )}
      >
        {previewMediaUrls[0]
          ? (
              <div className="relative h-full w-full">
                <Image src={previewMediaUrls[0]} alt="TikTok" fill className="object-cover" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-16 w-16 rounded-full bg-black/50 p-4 text-white" />
                </div>
              </div>
            )
          : (
              <div className="flex h-full items-center justify-center text-white">
                <Play className="h-16 w-16" />
              </div>
            )}
        <div className="absolute right-0 bottom-0 left-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-2">
            <AvatarComponent platform={platform} accounts={accounts} size={32} />
            <span className="text-sm font-semibold text-white">
              @
              {platformAccount?.account_name || 'username'}
            </span>
          </div>
          {previewTitle && (
            <p className="mt-2 text-sm font-semibold text-white">{previewTitle}</p>
          )}
          <p className="mt-2 line-clamp-2 text-sm text-white">{previewCaption || 'Your TikTok video'}</p>
          {previewHashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {previewHashtags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs text-white">
                  #
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="absolute right-0 bottom-0 z-10 flex flex-col gap-4 p-4">
          <button type="button" className="flex flex-col items-center gap-1">
            <div className="h-10 w-10 rounded-full border-2 border-white bg-slate-900" />
          </button>
          <button type="button" className="flex flex-col items-center gap-1">
            <ThumbsUp className="h-6 w-6 text-white" />
            <span className="text-xs text-white">1.2K</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-1">
            <MessageCircle className="h-6 w-6 text-white" />
            <span className="text-xs text-white">234</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-1">
            <Share2 className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{t('preview_empty')}</p>
    </div>
  );
}

export default function CreatePostPage() {
  const router = useRouter();
  const t = useTranslations('CreatePost');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const { selectedBrandId } = useBrand();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [baseCaption, setBaseCaption] = useState('');
  const [postTitle, setPostTitle] = useState(''); // Fallback title, managed via platformContent
  const [mainLink, setMainLink] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState<Record<Platform | 'base', string>>({} as Record<Platform | 'base', string>);
  // Platform-specific content (includes hashtags)
  const [platformContent, setPlatformContent] = useState<Record<Platform, { caption: string; title: string; link: string; mediaUrls: string[]; hashtags: string[] }>>({} as Record<Platform, { caption: string; title: string; link: string; mediaUrls: string[]; hashtags: string[] }>);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState<Platform | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState<Record<Platform | 'base', boolean>>({} as Record<Platform | 'base', boolean>);
  const [_minimizedPlatforms, _setMinimizedPlatforms] = useState<Record<Platform, boolean>>({} as Record<Platform, boolean>);
  const [aiBriefInput, setAiBriefInput] = useState<Record<Platform, string>>({} as Record<Platform, string>);
  const [aiToneInput, setAiToneInput] = useState<Record<Platform, string>>({} as Record<Platform, string>);
  const [aiLanguageInput, setAiLanguageInput] = useState<Record<Platform, 'en' | 'he'>>({} as Record<Platform, 'en' | 'he'>);
  const [aiStyleInput, setAiStyleInput] = useState<Record<Platform, string>>({} as Record<Platform, string>);

  const [aiBrief, setAiBrief] = useState('');
  const [aiTone, setAiTone] = useState(TONE_OPTIONS[0]);
  const [aiStyle, setAiStyle] = useState('');
  const [aiLanguage, setAiLanguage] = useState<'en' | 'he'>('en');
  const [_aiLoadingType, _setAiLoadingType] = useState<AiSuggestionType | null>(null);
  const [_aiVariantTarget, setAiVariantTarget] = useState('');
  const aiCaption: string | null = null; // Fallback AI caption, currently not set
  const fileInputRefs = React.useRef<Record<Platform | 'base', HTMLInputElement | null>>({} as Record<Platform | 'base', HTMLInputElement | null>);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState<Record<Platform | 'base', boolean>>({} as Record<Platform | 'base', boolean>);
  const [platformFormats, setPlatformFormats] = useState<Record<Platform, Format[]>>(DEFAULT_PLATFORM_FORMATS);

  // Metricool-style edit mode: 'unified' (first post copies to all) or 'per-platform' (edit by platform)
  const [editMode, setEditMode] = useState<'unified' | 'per-platform'>('unified');
  const [firstPlatform, setFirstPlatform] = useState<Platform | null>(null);
  const [activePerPlatformTab, setActivePerPlatformTab] = useState<Platform | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<'base' | string>('base');
  const [openPostTypePopovers, setOpenPostTypePopovers] = useState<Record<Platform, boolean>>({} as Record<Platform, boolean>);
  const captionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [mediaFiles, setMediaFiles] = useState<Array<{ url: string; type: 'image' | 'video' }>>([]);
  const [mediaMode, setMediaMode] = useState<Record<Platform | 'base', 'manual' | 'ai'>>({} as Record<Platform | 'base', 'manual' | 'ai'>);
  const [aiMediaPrompt, setAiMediaPrompt] = useState<Record<Platform | 'base', string>>({} as Record<Platform | 'base', string>);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState<Record<Platform | 'base', boolean>>({} as Record<Platform | 'base', boolean>);
  const [platformValidationErrors, setPlatformValidationErrors] = useState<Record<Platform, string[]>>({} as Record<Platform, string[]>);

  // Auto-detect content type based on media
  // Check if a format is valid for the current media state
  const isFormatValid = useCallback((platform: Platform, format: Format, mediaCount: number, hasVideo: boolean, mediaFiles: Array<{ type: string }>): { valid: boolean; reason?: string } => {
    // Check if format requires media
    if (FORMAT_REQUIRES_MEDIA[format] && mediaCount === 0) {
      return { valid: false, reason: t('format_requires_media') };
    }

    // Check if format requires video
    if (FORMAT_REQUIRES_VIDEO.includes(format) && !hasVideo) {
      return { valid: false, reason: t('format_requires_video') };
    }

    // Check minimum media count
    const minCount = FORMAT_MIN_MEDIA_COUNT[format];
    if (mediaCount < minCount) {
      return { valid: false, reason: t('format_requires_min_media', { count: minCount }) };
    }

    // Check maximum media count (platform-specific)
    const maxCount = FORMAT_MAX_MEDIA_COUNT[format];
    if (mediaCount > maxCount) {
      // Special case: TikTok carousel allows up to 35
      if (format === 'carousel' && platform === 'tiktok' && mediaCount <= 35) {
        return { valid: true };
      }
      if (mediaCount > maxCount) {
        return { valid: false, reason: t('format_exceeds_max_media', { count: maxCount }) };
      }
    }

    // Check if format requires multiple media
    if (FORMAT_REQUIRES_MULTIPLE_MEDIA.includes(format) && mediaCount < 2) {
      return { valid: false, reason: t('format_requires_multiple_media') };
    }

    // Platform-specific validations
    if (platform === 'instagram') {
      if (format === 'reel' && !hasVideo) {
        return { valid: false, reason: t('instagram_reel_requires_video') };
      }
      if (format === 'carousel' && mediaCount < 2) {
        return { valid: false, reason: t('instagram_carousel_requires_multiple') };
      }
      if (format === 'carousel' && mediaCount > 10) {
        return { valid: false, reason: t('instagram_carousel_max_10') };
      }
    }

    if (platform === 'tiktok') {
      if (format === 'carousel' && mediaCount > 35) {
        return { valid: false, reason: t('tiktok_carousel_max_35') };
      }
      // TikTok carousel cannot mix photos and videos
      if (format === 'carousel' && mediaFiles.length > 0) {
        const hasVideos = mediaFiles.some(f => f.type === 'video');
        const hasImages = mediaFiles.some(f => f.type === 'image');
        if (hasVideos && hasImages) {
          return { valid: false, reason: t('tiktok_carousel_no_mixing') };
        }
      }
    }

    if (platform === 'youtube') {
      if ((format === 'video' || format === 'short') && !hasVideo) {
        return { valid: false, reason: t('youtube_requires_video') };
      }
    }

    return { valid: true };
  }, [t]);

  const detectContentType = useCallback((platform: Platform, mediaCount: number, hasVideo: boolean): Format => {
    if (mediaCount === 0) {
      // No media = text post
      return platform === 'instagram' || platform === 'facebook' || platform === 'threads' ? 'feed' : 'post';
    }

    if (hasVideo) {
      // Video content
      if (platform === 'instagram') {
        return 'reel';
      }
      if (platform === 'youtube') {
        return mediaCount === 1 ? 'short' : 'video';
      }
      if (platform === 'tiktok') {
        return 'video';
      }
      return 'video';
    }

    // Image content
    if (mediaCount === 1) {
      // Single image
      return platform === 'instagram' || platform === 'facebook' || platform === 'threads' ? 'feed' : 'post';
    }

    // Multiple images = carousel (if supported)
    if (platform === 'instagram' && mediaCount <= 10) {
      return 'carousel';
    }
    if (platform === 'tiktok' && mediaCount <= 35) {
      return 'carousel';
    }
    if (platform === 'facebook' && mediaCount <= 10) {
      return 'feed';
    } // Facebook multi-image posts

    // Default to feed/post for other platforms
    return platform === 'instagram' || platform === 'facebook' || platform === 'threads' ? 'feed' : 'post';
  }, []);

  // Update media files when mediaUrls change
  useEffect(() => {
    const detectMediaTypes = async () => {
      const files: Array<{ url: string; type: 'image' | 'video' }> = [];
      for (const url of mediaUrls) {
        const isVideo = url.toLowerCase().includes('.mp4')
          || url.toLowerCase().includes('.mov')
          || url.toLowerCase().includes('.avi')
          || url.toLowerCase().includes('.webm')
          || url.toLowerCase().includes('video');
        files.push({ url, type: isVideo ? 'video' : 'image' });
      }
      setMediaFiles(files);
    };
    void detectMediaTypes();
  }, [mediaUrls]);

  const processMediaFiles = async (files: File[], platform?: Platform) => {
    if (files.length === 0) {
      return;
    }

    setIsUploadingMedia(true);
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
      const newUrls: string[] = [];
      const newFiles: Array<{ url: string; type: 'image' | 'video' }> = [];

      for (const file of files) {
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} exceeds 10MB limit`);
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName);

        newUrls.push(publicUrl);
        newFiles.push({
          url: publicUrl,
          type: file.type.startsWith('video/') ? 'video' : 'image',
        });
      }

      // Update platform-specific media if platform is provided
      if (platform) {
        setPlatformContent(prev => ({
          ...prev,
          [platform]: {
            ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [] }),
            mediaUrls: [...(prev[platform]?.mediaUrls || []), ...newUrls],
          },
        }));

        // Auto-detect content type based on media
        const platformMediaUrls = [...(platformContent[platform]?.mediaUrls || []), ...newUrls];
        const platformMediaFiles = [...mediaFiles, ...newFiles].filter(f => platformMediaUrls.includes(f.url));
        const mediaCount = platformMediaUrls.length;
        const hasVideo = platformMediaFiles.some(f => f.type === 'video');
        const detectedFormat = detectContentType(platform, mediaCount, hasVideo);
        const availableFormats = platformFormats[platform] || [];
        const currentVariants = variants.filter(v => v.platform === platform);
        const currentFormat = currentVariants[0]?.format;

        if (availableFormats.includes(detectedFormat) && currentFormat !== detectedFormat) {
          setVariants((prev) => {
            const filtered = prev.filter(v => v.platform !== platform);
            return [
              ...filtered,
              {
                id: randomId(),
                platform,
                format: detectedFormat,
                caption: platformContent[platform]?.caption || '',
                syncWithBase: false,
              },
            ];
          });
        }
      } else {
        // Update shared media (for backward compatibility)
        setMediaUrls(prev => [...prev, ...newUrls]);
      }

      setMediaFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('Media upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload media');
    } finally {
      setIsUploadingMedia(false);
      // Clear the file input for the platform that was used
      if (platform && fileInputRefs.current[platform]) {
        fileInputRefs.current[platform]!.value = '';
      } else if (!platform) {
        // Get selected platforms from variants
        const platformsFromVariants = Array.from(new Set(variants.map(v => v.platform)));
        if (platformsFromVariants.length > 0) {
          const firstPlatform = platformsFromVariants[0];
          if (firstPlatform && fileInputRefs.current[firstPlatform]) {
            // Fallback: clear first platform's input if no platform specified
            fileInputRefs.current[firstPlatform]!.value = '';
          }
        }
      }
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, platform?: Platform) => {
    const files = Array.from(e.target.files || []);
    await processMediaFiles(files, platform);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, platform: Platform) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(prev => ({ ...prev, [platform]: false }));

    const files = Array.from(e.dataTransfer.files).filter((file) => {
      return file.type.startsWith('image/') || file.type.startsWith('video/');
    });

    if (files.length > 0) {
      await processMediaFiles(files, platform);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, platform: Platform) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(prev => ({ ...prev, [platform]: true }));
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, platform: Platform) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone (not just moving to a child element)
    if (e.currentTarget === e.target) {
      setIsDraggingOver(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleGenerateAIMedia = async (platform: Platform) => {
    const prompt = aiMediaPrompt[platform]?.trim();
    if (!prompt) {
      setError(isRTL ? 'אנא הזן תיאור לתמונה' : 'Please enter a description for the image');
      return;
    }

    setIsGeneratingMedia(prev => ({ ...prev, [platform]: true }));
    setError(null);

    try {
      const response = await fetch('/api/ai/generate-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mediaType: 'image', // Only images supported for now
          size: '1024x1024',
          quality: 'standard',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || (isRTL ? 'שגיאה ביצירת תמונה' : 'Failed to generate image'));
      }

      const data = await response.json();

      // Add generated image to platform-specific media
      setPlatformContent(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          mediaUrls: [...(prev[platform]?.mediaUrls || []), data.url],
        },
      }));

      setMediaFiles(prev => [...prev, { url: data.url, type: 'image' }]);

      // Clear prompt after successful generation
      setAiMediaPrompt(prev => ({ ...prev, [platform]: '' }));
    } catch (err) {
      console.error('[AI Media] Error:', err);
      setError(err instanceof Error ? err.message : (isRTL ? 'שגיאה ביצירת תמונה' : 'Failed to generate image'));
    } finally {
      setIsGeneratingMedia(prev => ({ ...prev, [platform]: false }));
    }
  };

  const loadAccounts = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      let accountsQuery = supabase
        .from('social_accounts')
        .select('id, brand_id, platform, account_name, getlate_account_id, platform_specific_data')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('platform', { ascending: true });

      if (selectedBrandId) {
        accountsQuery = accountsQuery.eq('brand_id', selectedBrandId);
      }

      const { data, error: fetchError } = await accountsQuery;

      if (fetchError) {
        if (fetchError.message || fetchError.code || Object.keys(fetchError).length > 0) {
          console.error('[CreatePost] Error fetching accounts:', {
            message: fetchError.message,
            code: fetchError.code,
            details: fetchError,
          });
        }
        setAccounts([]);
        return;
      }

      const normalizedAccounts = (data || []).map((acc) => {
        const platformData = acc.platform_specific_data as Record<string, unknown> | null;
        const avatarUrl = platformData?.avatar_url || platformData?.profilePicture || null;
        const displayName = platformData?.display_name || acc.account_name || '';

        return {
          id: acc.id,
          brand_id: acc.brand_id,
          platform: (acc.platform === 'twitter' ? 'x' : acc.platform) as Platform,
          account_name: acc.account_name || '',
          getlate_account_id: acc.getlate_account_id || null,
          avatar_url: typeof avatarUrl === 'string' ? avatarUrl : null,
          display_name: typeof displayName === 'string' ? displayName : acc.account_name || '',
        };
      });
      setAccounts(normalizedAccounts);
    } catch (loadError) {
      console.error('[CreatePost] Unable to load accounts:', loadError);
      setAccounts([]);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // Clear platform selection when brand changes
  useEffect(() => {
    // Clear variants (which will clear formatMap and selectedPlatforms)
    setVariants([]);
    // Clear platform-specific content
    setPlatformContent({} as Record<Platform, { caption: string; title: string; link: string; mediaUrls: string[]; hashtags: string[] }>);
    // Clear active tabs
    setActivePlatformTab(null);
    setActivePerPlatformTab(null);
    setFirstPlatform(null);
    // Clear AI panels
    setShowAiPanel({} as Record<Platform | 'base', boolean>);
    // Clear validation errors
    setPlatformValidationErrors({} as Record<Platform, string[]>);
  }, [selectedBrandId]);

  // Load post types from Getlate API
  const loadPostTypes = useCallback(async () => {
    if (!selectedBrandId) {
      return;
    }

    try {
      const response = await fetch(`/api/getlate/post-types?brandId=${selectedBrandId}`);
      if (!response.ok) {
        console.warn('[CreatePost] Failed to load post types from Getlate, using defaults');
        return;
      }

      const data = await response.json();

      // Map Getlate format names to our Format type
      const mappedFormats: Record<Platform, Format[]> = { ...DEFAULT_PLATFORM_FORMATS };

      // Use formats from API if available, otherwise use defaults
      if (data.formats) {
        Object.entries(data.formats).forEach(([platform, formats]) => {
          const normalizedPlatform = platform === 'twitter' ? 'x' : platform as Platform;
          if (normalizedPlatform in mappedFormats) {
            // Map Getlate format names to our format names
            const mapped = (formats as string[]).map((f: string) => {
              // Map common variations based on Getlate API documentation
              if (f === 'article') {
                return 'post';
              }
              // Facebook doesn't support reels according to Getlate API docs - filter them out
              if (f === 'reel' && normalizedPlatform === 'facebook') {
                return null;
              }
              // Threads doesn't support reels according to Getlate API docs - filter them out
              if (f === 'reel' && normalizedPlatform === 'threads') {
                return null;
              }
              return f as Format | null;
            }).filter((f): f is Format => {
              return f !== null;
            }).filter((f: Format) => {
              // Validate format exists in our Format type
              return ['feed', 'story', 'reel', 'post', 'short', 'video', 'carousel', 'thread', 'pin', 'link'].includes(f);
            }) as Format[];

            // Remove duplicates (e.g., LinkedIn 'post' and 'article' both map to 'post')
            const uniqueFormats = Array.from(new Set(mapped)) as Format[];

            if (uniqueFormats.length > 0) {
              mappedFormats[normalizedPlatform] = uniqueFormats;
            }
          }
        });
      }

      // Also use platforms array to ensure we have formats for platforms with accounts
      if (data.platforms && Array.isArray(data.platforms)) {
        data.platforms.forEach((platformData: { platform: string; formats: string[] }) => {
          const normalizedPlatform = platformData.platform === 'twitter' ? 'x' : platformData.platform as Platform;
          if (normalizedPlatform && platformData.formats && Array.isArray(platformData.formats)) {
            const mapped = platformData.formats.map((f: string) => {
              // Map common variations based on Getlate API documentation
              if (f === 'article') {
                return 'post';
              }
              // Facebook doesn't support reels according to Getlate API docs - filter them out
              if (f === 'reel' && normalizedPlatform === 'facebook') {
                return null;
              }
              // Threads doesn't support reels according to Getlate API docs - filter them out
              if (f === 'reel' && normalizedPlatform === 'threads') {
                return null;
              }
              return f as Format | null;
            }).filter((f): f is Format => {
              return f !== null && ['feed', 'story', 'reel', 'post', 'short', 'video', 'carousel', 'thread', 'pin', 'link'].includes(f);
            }) as Format[];

            const uniqueFormats = Array.from(new Set(mapped)) as Format[];
            if (uniqueFormats.length > 0) {
              mappedFormats[normalizedPlatform] = uniqueFormats;
            }
          }
        });
      }

      setPlatformFormats(mappedFormats);
    } catch (error) {
      console.error('[CreatePost] Error loading post types:', error);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    void loadPostTypes();
  }, [loadPostTypes]);

  const formatMap = useMemo(() => {
    const map = new Map<Platform, Set<Format>>();
    variants.forEach((variant) => {
      const existing = map.get(variant.platform) ?? new Set<Format>();
      existing.add(variant.format);
      map.set(variant.platform, existing);
    });
    return map;
  }, [variants]);

  const selectedPlatforms = useMemo(() => Array.from(formatMap.keys()), [formatMap]);
  const isPlatformSelected = selectedPlatforms.length > 0;

  // Validate platform content and return errors
  const validatePlatform = useCallback((platform: Platform): string[] => {
    const errors: string[] = [];

    // Get platform content
    const platformContentData = platformContent[platform] || { caption: baseCaption, title: postTitle, link: mainLink, mediaUrls: [] };
    const platformMediaUrls = platformContentData.mediaUrls.length > 0 ? platformContentData.mediaUrls : mediaUrls;
    const platformMediaFiles = mediaFiles.filter(f => platformMediaUrls.includes(f.url));
    const mediaCount = platformMediaUrls.length;
    const hasVideo = platformMediaFiles.some(f => f.type === 'video');

    // Get selected format for this platform
    const platformVariants = variants.filter(v => v.platform === platform);
    const format = platformVariants[0]?.format;

    // Check if platform is selected
    if (!selectedPlatforms.includes(platform)) {
      return errors; // Skip validation if platform not selected
    }

    // Validate content length
    const content = platformContentData.caption || baseCaption || '';
    const limit = PLATFORM_CHARACTER_LIMITS[platform];
    if (content.length > limit) {
      errors.push(isRTL
        ? `תוכן ארוך מדי (${content.length}/${limit} תווים)`
        : `Content too long (${content.length}/${limit} characters)`);
    }

    // Validate required content
    if (!content.trim() && format && !FORMAT_REQUIRES_MEDIA[format]) {
      errors.push(isRTL ? 'תוכן נדרש' : 'Content is required');
    }

    // Validate format/media requirements
    if (format) {
      const validation = isFormatValid(platform, format, mediaCount, hasVideo, platformMediaFiles);
      if (!validation.valid && validation.reason) {
        errors.push(validation.reason);
      }
    }

    return errors;
  }, [platformContent, baseCaption, postTitle, mainLink, mediaUrls, mediaFiles, variants, selectedPlatforms, isFormatValid, isRTL]);

  // Validate all selected platforms
  const validateAllPlatforms = useCallback(() => {
    const errors: Record<Platform, string[]> = {} as Record<Platform, string[]>;
    selectedPlatforms.forEach((platform) => {
      errors[platform] = validatePlatform(platform);
    });
    setPlatformValidationErrors(errors);
    return errors;
  }, [selectedPlatforms, validatePlatform]);

  // Auto-validate when content or media changes
  useEffect(() => {
    if (selectedPlatforms.length > 0) {
      validateAllPlatforms();
    }
  }, [baseCaption, platformContent, mediaUrls, mediaFiles, variants, selectedPlatforms, validateAllPlatforms]);

  // Auto-update format when media changes (moved after selectedPlatforms definition)
  useEffect(() => {
    if (selectedPlatforms.length === 0) {
      return;
    }

    const mediaCount = mediaUrls.length;
    const hasVideo = mediaFiles.length > 0 && mediaFiles.some(f => f.type === 'video');

    selectedPlatforms.forEach((platform) => {
      const currentVariants = variants.filter(v => v.platform === platform);
      const currentFormat = currentVariants[0]?.format;
      const detectedFormat = detectContentType(platform, mediaCount, hasVideo);
      const availableFormats = platformFormats[platform] || [];

      // Only auto-update if detected format is available and different from current
      if (availableFormats.includes(detectedFormat) && currentFormat !== detectedFormat) {
        // Use setVariants directly to avoid infinite loop
        setVariants((prev) => {
          const filtered = prev.filter(v => v.platform !== platform);
          return [
            ...filtered,
            {
              id: randomId(),
              platform,
              format: detectedFormat,
              caption: baseCaption,
              syncWithBase: true,
            },
          ];
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrls.length, mediaFiles.length, selectedPlatforms.length]);

  // Set active platform tab and first platform for unified mode
  useEffect(() => {
    if (selectedPlatforms.length > 0) {
      const firstSelectedPlatform = selectedPlatforms[0] ?? null;
      const shouldUpdate = !activePlatformTab || !selectedPlatforms.includes(activePlatformTab);
      if (shouldUpdate) {
        setActivePlatformTab(firstSelectedPlatform);
      }
      // Set first platform for unified mode copying
      if (!firstPlatform && firstSelectedPlatform) {
        setFirstPlatform(firstSelectedPlatform);
      }
      // Set active per-platform tab when entering per-platform mode
      if (editMode === 'per-platform' && (!activePerPlatformTab || !selectedPlatforms.includes(activePerPlatformTab))) {
        setActivePerPlatformTab(firstSelectedPlatform);
      }
    } else {
      setFirstPlatform(null);
      setActivePerPlatformTab(null);
    }
  }, [selectedPlatforms, activePlatformTab, firstPlatform, editMode, activePerPlatformTab]);

  // Handle unified mode: when typing in first platform, copy to all other selected platforms
  const handleUnifiedCaptionChange = (value: string, sourcePlatform: Platform) => {
    if (editMode === 'unified' && sourcePlatform === firstPlatform && selectedPlatforms.length > 1) {
      // Update first platform content
      setPlatformContent(prev => ({
        ...prev,
        [sourcePlatform]: {
          ...(prev[sourcePlatform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
          caption: value,
        },
      }));

      // Copy to all other selected platforms
      const otherPlatforms = selectedPlatforms.filter(p => p !== sourcePlatform);
      setPlatformContent((prev) => {
        const updated = { ...prev };
        otherPlatforms.forEach((platform) => {
          updated[platform] = {
            ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
            caption: value,
          };
        });
        return updated;
      });

      // Also update baseCaption for backward compatibility
      setBaseCaption(value);
    } else {
      // Per-platform mode or only one platform selected
      setPlatformContent(prev => ({
        ...prev,
        [sourcePlatform]: {
          ...(prev[sourcePlatform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
          caption: value,
        },
      }));
      if (sourcePlatform === firstPlatform) {
        setBaseCaption(value);
      }
    }
  };

  const handleToggleFormat = (platform: Platform, format: Format) => {
    setVariants((prev) => {
      // Remove all existing variants for this platform (only one format per platform allowed)
      const filtered = prev.filter(v => v.platform !== platform);

      // Add the new format variant
      return [
        ...filtered,
        {
          id: randomId(),
          platform,
          format,
          caption: baseCaption,
          syncWithBase: true,
        },
      ];
    });
  };

  // Check if a platform has a connected account
  const isPlatformConnected = (platform: Platform): boolean => {
    return accounts.some(acc =>
      acc.platform === platform
      && acc.getlate_account_id
      && acc.getlate_account_id.trim() !== '',
    );
  };

  const handleTogglePlatform = (platform: Platform) => {
    // Prevent selection if platform is not connected
    if (!isPlatformConnected(platform)) {
      setError(isRTL ? 'פלטפורמה זו לא מחוברת. אנא עבור לדף החיבורים וחבר אותה תחילה.' : 'This platform is not connected. Please go to the connections page and connect it first.');
      return;
    }

    // Clear any previous errors
    setError(null);

    const platformVariants = variants.filter(variant => variant.platform === platform);
    if (platformVariants.length === 0) {
      // Platform is being selected - add default format and initialize content
      const [defaultFormat] = platformFormats[platform] || ['post'];
      if (defaultFormat) {
        handleToggleFormat(platform, defaultFormat);
      }
      // Initialize platform content with base values only if it doesn't exist
      // This preserves AI-generated content when re-selecting a platform
      setPlatformContent((prev) => {
        if (prev[platform]) {
          // Content already exists, keep it
          return prev;
        }
        return {
          ...prev,
          [platform]: {
            caption: baseCaption,
            title: postTitle,
            link: mainLink,
            mediaUrls: [],
          },
        };
      });
      if (!activePlatformTab) {
        setActivePlatformTab(platform);
      }
      return;
    }
    // Platform is being deselected - remove variants but keep content for later use
    setVariants(prev => prev.filter(variant => variant.platform !== platform));
    // Don't delete platform content - preserve it for when user re-selects the platform
    setOpenPostTypePopovers(prev => ({ ...prev, [platform]: false }));
  };

  useEffect(() => {
    setVariants((prev) => {
      const hasSyncedVariants = prev.some(v => v.syncWithBase);
      if (!hasSyncedVariants) {
        return prev; // No change needed
      }
      // Check if any synced variant needs updating
      const needsUpdate = prev.some(v => v.syncWithBase && v.caption !== baseCaption);
      if (!needsUpdate) {
        return prev; // No change needed
      }
      return prev.map(variant => (
        variant.syncWithBase ? { ...variant, caption: baseCaption } : variant
      ));
    });
  }, [baseCaption]); // Only depend on baseCaption, not variants

  useEffect(() => {
    if (variants.length === 0) {
      if (_aiVariantTarget !== '') {
        setAiVariantTarget('');
      }
      return;
    }
    const currentTargetExists = variants.some(v => v.id === _aiVariantTarget);
    if (!currentTargetExists) {
      const newTarget = variants[0]?.id ?? '';
      if (newTarget !== _aiVariantTarget) {
        setAiVariantTarget(newTarget);
      }
    }
  }, [variants, _aiVariantTarget]);

  const insertEmoji = (emoji: string, target: Platform | 'base' = 'base') => {
    if (target === 'base') {
      const textarea = captionTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = baseCaption;
        const newText = text.slice(0, start) + emoji + text.slice(end);
        setBaseCaption(newText);
        // Set cursor position after emoji
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
      } else {
        setBaseCaption(prev => prev + emoji);
      }
    } else {
      // Insert into platform-specific content
      const platformContentData = platformContent[target] || { caption: '', title: '', link: '', mediaUrls: [] };
      const textarea = document.querySelector(`textarea[data-platform="${target}"]`) as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = platformContentData.caption;
        const newText = text.slice(0, start) + emoji + text.slice(end);
        setPlatformContent(prev => ({
          ...prev,
          [target]: { ...prev[target], caption: newText },
        }));
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
      } else {
        setPlatformContent(prev => ({
          ...prev,
          [target]: { ...prev[target], caption: (prev[target]?.caption || '') + emoji },
        }));
      }
    }
    setShowEmojiPicker(false);
  };

  const addHashtag = (e: React.KeyboardEvent<HTMLInputElement>, platform: Platform) => {
    const currentInput = hashtagInput[platform] || '';
    if (e.key !== 'Enter' || !currentInput.trim()) {
      return;
    }
    e.preventDefault();
    const normalized = currentInput.trim().replace(/^#/, '');
    setHashtagInput(prev => ({ ...prev, [platform]: '' }));

    const platformHashtags = platformContent[platform]?.hashtags || [];
    if (!platformHashtags.includes(normalized)) {
      setPlatformContent(prev => ({
        ...prev,
        [platform]: {
          ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
          hashtags: [...platformHashtags, normalized],
        },
      }));
    }
  };

  const removeHashtag = (tagToRemove: string, platform: Platform) => {
    const platformHashtags = platformContent[platform]?.hashtags || [];
    setPlatformContent(prev => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
        hashtags: platformHashtags.filter(tag => tag !== tagToRemove),
      },
    }));
  };

  const handleGenerateAll = useCallback(async (briefText?: string, tone?: string, language?: 'en' | 'he', style?: string, platform?: Platform) => {
    const targetPlatform = platform || activePlatformTab || selectedPlatforms[0];
    if (!targetPlatform) {
      return;
    }

    const platformContentData = platformContent[targetPlatform] || { caption: '', title: '', link: '', mediaUrls: [] };
    let briefToUse = briefText?.trim() || aiBrief.trim() || platformContentData.caption.trim();

    // Validate and truncate brief to 1200 characters (API limit)
    const MAX_BRIEF_LENGTH = 1200;
    if (briefToUse.length > MAX_BRIEF_LENGTH) {
      const truncated = briefToUse.substring(0, MAX_BRIEF_LENGTH);
      briefToUse = truncated;
      // Show warning but continue with truncated text
      setError(isRTL
        ? `התיאור ארוך מדי. קוצר ל-${MAX_BRIEF_LENGTH} תווים.`
        : `Brief is too long. Truncated to ${MAX_BRIEF_LENGTH} characters.`);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }

    const toneToUse = tone || aiTone;
    const languageToUse = language || aiLanguage;
    const styleToUse = style?.trim() || aiStyle.trim();
    const platformMediaUrls = platformContentData.mediaUrls.length > 0 ? platformContentData.mediaUrls : mediaUrls;
    const platformMediaFiles = mediaFiles.filter(f => platformMediaUrls.includes(f.url));

    setIsGeneratingAll(true);
    setError(null); // Clear any previous errors

    // Update main state with values
    if (briefToUse) {
      setAiBrief(briefToUse);
    }
    if (toneToUse) {
      setAiTone(toneToUse);
    }
    if (languageToUse) {
      setAiLanguage(languageToUse);
    }
    if (styleToUse) {
      setAiStyle(styleToUse);
    }

    try {
      // Get platform-specific character limit and cap at API maximum (10000)
      const platformLimit = Math.min(PLATFORM_CHARACTER_LIMITS[targetPlatform] || 280, 10000);

      // Generate all suggestions in a single API call - use current content as context
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'all',
          brief: briefToUse,
          baseContent: platformContentData.caption.trim(), // Current caption content
          postTitle: platformContentData.title.trim(),
          tone: toneToUse,
          style: styleToUse,
          language: languageToUse,
          platform: targetPlatform,
          mediaUrls: platformMediaUrls,
          mediaTypes: platformMediaFiles.map(f => f.type),
          characterLimit: platformLimit,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        // Parse Zod validation errors for better user feedback
        if (errorBody.error && typeof errorBody.error === 'string' && errorBody.error.includes('Too big')) {
          throw new Error(isRTL
            ? 'התיאור ארוך מדי. אנא קיצר אותו ל-1200 תווים או פחות.'
            : 'Brief is too long. Please shorten it to 1200 characters or less.');
        }
        throw new Error(errorBody?.error || t('ai_error'));
      }

      const data = await response.json();

      // Check if we're in unified mode (base) or per-platform mode
      // If platform is undefined or editMode is unified, treat as unified mode
      const isUnifiedMode = !platform || editMode === 'unified';

      // Parse JSON response and apply values to platform-specific content
      // Expected format: { "title": "...", "caption": "...", "hashtags": [...] }
      const generatedTitle = data.title?.trim() || '';
      const generatedCaption = data.caption?.trim() || '';

      if (isUnifiedMode) {
        // In unified mode, update all selected platforms and postTitle state
        if (generatedTitle) {
          setPostTitle(generatedTitle);
        }
        if (generatedCaption) {
          setBaseCaption(generatedCaption);
        }

        // Update all selected platforms with generated content
        selectedPlatforms.forEach((platform) => {
          setPlatformContent(prev => ({
            ...prev,
            [platform]: {
              ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
              title: generatedTitle || prev[platform]?.title || '',
              caption: generatedCaption || prev[platform]?.caption || '',
            },
          }));
        });
      } else {
        // Per-platform mode: only update the target platform
        setPlatformContent(prev => ({
          ...prev,
          [targetPlatform]: {
            ...prev[targetPlatform],
            title: generatedTitle || prev[targetPlatform]?.title || '',
            caption: generatedCaption || prev[targetPlatform]?.caption || '',
          },
        }));

        // Also update postTitle if this is the first platform or if postTitle is empty
        if (generatedTitle && (!postTitle || targetPlatform === selectedPlatforms[0])) {
          setPostTitle(generatedTitle);
        }
      }

      if (Array.isArray(data.hashtags) && data.hashtags.length > 0) {
        const normalizedHashtags = data.hashtags.map((tag: string) => tag.replace(/^#/, ''));

        if (isUnifiedMode) {
          // Update hashtags for all platforms in unified mode
          selectedPlatforms.forEach((platform) => {
            const platformHashtags = platformContent[platform]?.hashtags || [];
            setPlatformContent(prev => ({
              ...prev,
              [platform]: {
                ...prev[platform],
                hashtags: (() => {
                  const combined = [...platformHashtags];
                  normalizedHashtags.forEach((tag: string) => {
                    if (tag && !combined.includes(tag)) {
                      combined.push(tag);
                    }
                  });
                  return combined;
                })(),
              },
            }));
          });
        } else {
          // Per-platform mode: only update target platform
          const platformHashtags = platformContent[targetPlatform]?.hashtags || [];
          setPlatformContent(prev => ({
            ...prev,
            [targetPlatform]: {
              ...prev[targetPlatform],
              hashtags: (() => {
                const combined = [...platformHashtags];
                normalizedHashtags.forEach((tag: string) => {
                  if (tag && !combined.includes(tag)) {
                    combined.push(tag);
                  }
                });
                return combined;
              })(),
            },
          }));
        }
      }

      // Update AI brief if provided
      if (briefToUse) {
        setAiBrief(briefToUse);
      }
    } catch (error) {
      console.error('[AI] Generate all failed', error);
      setError(error instanceof Error ? error.message : t('ai_error'));
    } finally {
      setIsGeneratingAll(false);
    }
  }, [aiBrief, aiTone, aiStyle, aiLanguage, platformContent, activePlatformTab, selectedPlatforms, mediaUrls, mediaFiles, editMode, postTitle, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Require brand selection
    if (!selectedBrandId) {
      setError(isRTL ? 'אנא בחר מותג לפני יצירת פוסט' : 'Please select a brand before creating a post');
      return;
    }

    if (!isPlatformSelected) {
      setError(t('error_content_required'));
      return;
    }

    // Check if at least one platform has content
    const hasContent = selectedPlatforms.some((platform) => {
      const platformContentData = platformContent[platform];
      return platformContentData?.caption?.trim() || baseCaption.trim();
    });

    if (!hasContent) {
      setError(t('error_content_required'));
      return;
    }

    // Validate formats against media requirements
    for (const platform of selectedPlatforms) {
      const platformVariants = variants.filter(v => v.platform === platform);
      const format = platformVariants[0]?.format;
      if (!format) {
        continue;
      }

      const platformContentData = platformContent[platform] || { caption: baseCaption, title: postTitle, link: mainLink, mediaUrls: [] };
      const platformMediaUrls = platformContentData.mediaUrls.length > 0 ? platformContentData.mediaUrls : mediaUrls;
      const platformMediaFiles = mediaFiles.filter(f => platformMediaUrls.includes(f.url));
      const mediaCount = platformMediaUrls.length;
      const hasVideo = platformMediaFiles.some(f => f.type === 'video');

      const validation = isFormatValid(platform, format, mediaCount, hasVideo, platformMediaFiles);
      if (!validation.valid) {
        const config = PLATFORM_ICON_CONFIG[platform];
        setError(`${config.name}: ${validation.reason || t('format_requires_media')}`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('error_not_logged_in'));
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const createPostForBrand = async (brandId: string, brandAccounts: Account[]) => {
        const { data: brandData } = await supabase
          .from('brands')
          .select('getlate_profile_id')
          .eq('id', brandId)
          .eq('user_id', userId)
          .single();

        const useGetlate = !!brandData?.getlate_profile_id;

        // Build platforms array according to Getlate API structure
        // Each platform can have platform-specific content in platformSpecificData
        // IMPORTANT: Include ALL accounts for each platform, not just the first one
        // This ensures we don't create duplicate posts when multiple accounts exist for the same platform
        const platformsArray: Array<{
          platform: string;
          account_id: string;
          config: Record<string, unknown>;
        }> = [];

        // Process each selected platform
        for (const platform of selectedPlatforms) {
          // Get ALL accounts for this platform (not just the first one)
          const platformAccounts = brandAccounts.filter(acc => acc.platform === platform);

          if (platformAccounts.length === 0) {
            continue; // Skip if no accounts for this platform
          }

          const platformContentData = platformContent[platform] || { caption: baseCaption, title: postTitle, link: mainLink, mediaUrls: [] };
          const platformVariants = variants.filter(v => v.platform === platform);
          const format = platformVariants[0]?.format || (platformFormats[platform]?.[0] || 'post');

          // Build platform-specific data according to Getlate API
          const platformSpecificData: Record<string, unknown> = {
            format, // Content type/format for this platform
          };

          // Add platform-specific content if different from base
          let finalContent = platformContentData.caption || baseCaption;

          // If link is provided, add note about link in first comment and store link separately
          const platformLink = platformContentData.link || mainLink;
          if (platformLink && platformLink.trim()) {
            // Add note to content about link being in first comment
            const linkNote = isRTL
              ? '\n\n🔗 הקישור נוסף בתגובה הראשונה'
              : '\n\n🔗 Link is added in the first comment';

            // Only add note if not already present
            if (!finalContent.includes('first comment') && !finalContent.includes('תגובה הראשונה')) {
              finalContent = finalContent + linkNote;
            }

            // Store link for posting as first comment
            platformSpecificData.firstComment = platformLink.trim();
          }

          if (finalContent && finalContent !== baseCaption) {
            platformSpecificData.content = finalContent;
          }
          if (platformContentData.title) {
            platformSpecificData.title = platformContentData.title;
          }
          // Add platform-specific hashtags
          if (platformContentData.hashtags && platformContentData.hashtags.length > 0) {
            platformSpecificData.hashtags = platformContentData.hashtags;
          }

          // Add platform-specific media if different
          const platformMediaUrls = platformContentData.mediaUrls.length > 0 ? platformContentData.mediaUrls : [];
          if (platformMediaUrls.length > 0) {
            const platformMediaFiles = mediaFiles.filter(f => platformMediaUrls.includes(f.url));
            platformSpecificData.mediaItems = platformMediaUrls.map((url) => {
              const mediaFile = platformMediaFiles.find(f => f.url === url);
              return {
                type: mediaFile?.type || 'image',
                url,
              };
            });
          }

          // Create ONE entry per account for this platform
          // According to Getlate API, each platform entry should have a unique accountId
          // If multiple accounts exist for the same platform, they should be separate entries
          // BUT: Getlate API might not support multiple accounts of the same platform in one post
          // So we'll use only the first account to avoid duplicates
          // If user wants to post to multiple accounts of the same platform, they should create separate posts
          const account = platformAccounts[0]; // Use first account to avoid duplicate posts

          if (account?.id) {
            platformsArray.push({
              platform: platform === 'x' ? 'twitter' : platform, // Getlate uses 'twitter' not 'x'
              account_id: account.id,
              config: platformSpecificData,
            });
          }
        }

        if (platformsArray.length === 0) {
          return null;
        }

        // Get shared content and media (use first platform's content as base, or combine)
        // According to Getlate API, we can use shared content at root level
        const firstPlatform = selectedPlatforms[0];
        if (!firstPlatform) {
          return null;
        }
        const firstPlatformContent = platformContent[firstPlatform] || { caption: baseCaption, title: postTitle, link: mainLink, mediaUrls: [] };
        let sharedContent = firstPlatformContent.caption || baseCaption;

        // If link is provided, add note about link in first comment
        const sharedLink = firstPlatformContent.link || mainLink;
        if (sharedLink && sharedLink.trim()) {
          const linkNote = isRTL
            ? '\n\n🔗 הקישור נוסף בתגובה הראשונה'
            : '\n\n🔗 Link is added in the first comment';

          // Only add note if not already present
          if (!sharedContent.includes('first comment') && !sharedContent.includes('תגובה הראשונה')) {
            sharedContent = sharedContent + linkNote;
          }
        }
        const sharedMediaUrls = mediaUrls.length > 0 ? mediaUrls : (firstPlatformContent.mediaUrls || []);
        const sharedMediaFiles = mediaFiles.filter(f => sharedMediaUrls.includes(f.url));

        // Create ONE post with all platforms (Getlate API structure)
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: sharedContent,
            ai_caption: aiCaption,
            image_url: sharedMediaUrls[0] || null,
            // Use hashtags from first platform as shared hashtags (Getlate API supports both root and platform-specific)
            hashtags: firstPlatformContent.hashtags || [],
            media_type: sharedMediaUrls.length > 0
              ? (sharedMediaFiles.some(f => f.type === 'video') ? 'video' : 'image')
              : 'text',
            scheduled_for: scheduleMode === 'later' && scheduledTime ? localToUtc(scheduledTime) : undefined,
            timezone,
            brand_id: brandId,
            platforms: platformsArray,
            use_getlate: useGetlate,
            metadata: {
              media_urls: sharedMediaUrls,
              ai_brief: aiBrief,
              // Store platform-specific content in metadata for reference
              platform_content: Object.fromEntries(
                selectedPlatforms.map(platform => [
                  platform,
                  platformContent[platform] || { caption: baseCaption, title: postTitle, link: mainLink, mediaUrls: [], hashtags: [] },
                ]),
              ),
            },
          }),
        });

        if (!response.ok) {
          const responseBody = await response.json();
          throw new Error(responseBody.error || 'Post creation failed');
        }

        return response.json();
      };

      if (!selectedBrandId) {
        const accountsByBrand = new Map<string, Account[]>();
        accounts.forEach((account) => {
          if (!selectedPlatforms.includes(account.platform)) {
            return;
          }
          const bucket = accountsByBrand.get(account.brand_id) ?? [];
          bucket.push(account);
          accountsByBrand.set(account.brand_id, bucket);
        });

        if (accountsByBrand.size === 0) {
          throw new Error(t('error_no_accounts'));
        }

        const promises = Array.from(accountsByBrand.entries()).map(([brandId, brandAccounts]) =>
          createPostForBrand(brandId, brandAccounts),
        );

        const results = await Promise.all(promises);
        if (results.every(result => result === null)) {
          throw new Error(t('error_create_failed'));
        }
      } else {
        const brandAccounts = accounts.filter(account => account.brand_id === selectedBrandId);
        if (!brandAccounts.length) {
          throw new Error(t('error_no_accounts'));
        }
        await createPostForBrand(selectedBrandId, brandAccounts);
      }

      router.push('/dashboard');
    } catch (submitError) {
      console.error('Error creating post:', submitError);
      setError(submitError instanceof Error ? submitError.message : t('error_create_post_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        </div>

        {/* Check if brand is selected */}
        {!selectedBrandId
          ? (
              <Card className="border-2 border-amber-200 bg-amber-50/50 shadow-lg">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 rounded-full bg-amber-100 p-4">
                    <AlertCircle className="h-12 w-12 text-amber-600" />
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                    {isRTL ? 'אנא בחר מותג' : 'Please Select a Brand'}
                  </h2>
                  <p className="mb-6 max-w-md text-slate-600">
                    {isRTL
                      ? 'על מנת ליצור פוסטים, אנא בחר מותג מהתפריט למעלה.'
                      : 'To create posts, please select a brand from the menu above.'}
                  </p>
                </CardContent>
              </Card>
            )
          : !accounts.some(acc => acc.getlate_account_id && acc.getlate_account_id.trim() !== '')
              ? (
                  <Card className="border-2 border-pink-200 bg-pink-50/50 shadow-lg">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 rounded-full bg-pink-100 p-4">
                        <Users className="h-12 w-12 text-pink-500" />
                      </div>
                      <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                        {isRTL ? 'אין חשבונות מחוברים' : 'No Connected Accounts'}
                      </h2>
                      <p className="mb-6 max-w-md text-slate-600">
                        {isRTL
                          ? 'על מנת ליצור פוסטים, אנא עבור לדף החיבורים וחבר חשבון עבור המותג הזה.'
                          : 'To create posts, please go to the connections page and connect an account for this brand.'}
                      </p>
                      <Link href="/connections">
                        <Button className="gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700">
                          <Users className="h-4 w-4" />
                          {isRTL ? 'עבור לדף החיבורים' : 'Go to Connections Page'}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )
              : (
                  <form onSubmit={handleSubmit} className="space-y-6 pb-24">
                    {/* Metricool-style Layout: Split Panel - Content takes half, buttons full width */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Left Panel - Post Creation (Half Width) */}
                      <div className="space-y-4">
                        {/* Platform Selection Bar (Metricool-style horizontal bar) - Only Connected Platforms */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                          {Object.entries(PLATFORM_ICON_CONFIG)
                            .filter(([platformKey]) => {
                              const platform = platformKey as Platform;
                              return isPlatformConnected(platform);
                            })
                            .map(([platformKey, config]) => {
                              const platform = platformKey as Platform;
                              const Icon = config.icon;
                              const selectedFormats = Array.from(formatMap.get(platform) ?? []);
                              const isSelected = selectedFormats.length > 0;
                              const availableFormats = platformFormats[platform] || [];
                              const isConnected = isPlatformConnected(platform);

                              // Only render if platform is connected
                              if (!isConnected) {
                                return null;
                              }

                              return (
                                <div
                                  key={platform}
                                  className={cn(
                                    'flex shrink-0 items-center gap-2 rounded-lg border-2 p-2 transition-all',
                                    isSelected
                                      ? 'border-pink-500 bg-pink-50'
                                      : 'border-slate-200 bg-white hover:border-slate-300',
                                    (!isConnected || !selectedBrandId) && 'opacity-50 cursor-not-allowed',
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isConnected && selectedBrandId) {
                                        handleTogglePlatform(platform);
                                      }
                                    }}
                                    disabled={!isConnected || !selectedBrandId}
                                    className={cn(
                                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                                      config.bg,
                                      (!isConnected || !selectedBrandId) && 'cursor-not-allowed opacity-50',
                                    )}
                                    title={
                                      !selectedBrandId
                                        ? (isRTL ? 'אנא בחר מותג תחילה' : 'Please select a brand first')
                                        : !isConnected
                                            ? (isRTL ? 'פלטפורמה זו לא מחוברת' : 'This platform is not connected')
                                            : undefined
                                    }
                                  >
                                    <Icon className="h-5 w-5 text-white" />
                                  </button>
                                  {isSelected && availableFormats.length > 0 && isConnected && (
                                    <Select
                                      value={selectedFormats[0] || availableFormats[0] || ''}
                                      onValueChange={value => handleToggleFormat(platform, value as Format)}
                                    >
                                      <SelectTrigger className="h-8 min-w-[80px] border-0 bg-transparent px-2 py-0 text-xs font-medium shadow-none hover:bg-transparent">
                                        <SelectValue placeholder="POST" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableFormats.map(format => (
                                          <SelectItem key={format} value={format}>
                                            {FORMAT_LABELS[format]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              );
                            })}
                        </div>

                        {/* Unified Content Editor (Metricool-style) - Always visible when platforms selected */}
                        {selectedPlatforms.length > 0 && (
                          <Card className="border-0 shadow-lg">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                  <Users className="h-5 w-5 text-pink-500" />
                                  {isRTL ? 'תוכן משותף לכל הפלטפורמות' : 'Shared Content for All Platforms'}
                                </CardTitle>
                                {selectedPlatforms.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditMode(editMode === 'unified' ? 'per-platform' : 'unified')}
                                    className="gap-2 text-xs"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {editMode === 'unified' ? (isRTL ? 'ערוך לפי פלטפורמה' : 'EDIT BY PLATFORM') : (isRTL ? 'ערוך יחד' : 'EDIT TOGETHER')}
                                  </Button>
                                )}
                              </div>
                              {/* Platform badges */}
                              {selectedPlatforms.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {selectedPlatforms.map((platform) => {
                                    const Icon = PLATFORM_ICON_CONFIG[platform]?.icon;
                                    const config = PLATFORM_ICON_CONFIG[platform];
                                    const selectedFormats = Array.from(formatMap.get(platform) ?? []);
                                    return (
                                      <div
                                        key={platform}
                                        className={cn(
                                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                                          'bg-white border-pink-200 text-slate-700',
                                        )}
                                      >
                                        {Icon && (
                                          <div className={cn('flex h-4 w-4 items-center justify-center rounded', config.bg)}>
                                            <Icon className="h-2.5 w-2.5 text-white" />
                                          </div>
                                        )}
                                        <span>{config.name}</span>
                                        {selectedFormats[0] && (
                                          <span className="text-slate-400">
                                            •
                                            {FORMAT_LABELS[selectedFormats[0] as Format]}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="p-6">
                              <div className="space-y-4">
                                {/* Create with AI Button - First */}
                                <div className="flex items-center justify-center">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setShowAiPanel(prev => ({ ...prev, base: !prev.base }));
                                      if (!aiBrief) {
                                        setAiBrief(baseCaption || '');
                                      }
                                    }}
                                    className={cn(
                                      'h-9 gap-2 text-sm border-pink-300 text-pink-600 hover:bg-pink-50 whitespace-nowrap',
                                      showAiPanel.base && 'bg-pink-50 border-pink-400',
                                    )}
                                  >
                                    <Wand2 className="h-4 w-4" />
                                    {isRTL ? 'צור באמצעות AI' : 'Create with AI'}
                                  </Button>
                                </div>

                                {/* AI Prompt Panel - Opens directly under button */}
                                {showAiPanel.base && (
                                  <div className="space-y-4 rounded-lg border border-pink-200 bg-pink-50/50 p-4">
                                    <div className="space-y-2">
                                      <label className="block text-sm font-semibold text-pink-700">
                                        {isRTL ? 'על מה הפוסט?' : 'What is the post about?'}
                                      </label>
                                      <div className="relative">
                                        <Textarea
                                          value={aiBrief || ''}
                                          onChange={e => setAiBrief(e.target.value)}
                                          placeholder={isRTL
                                            ? 'למשל: השקת מוצר חדש, טיפ מקצועי, סיפור אישי...'
                                            : 'e.g., New product launch, professional tip, personal story...'}
                                          className={cn(
                                            'min-h-[80px] resize-none rounded-lg border-pink-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400 pr-16',
                                            (aiBrief || '').length > 1200 && 'border-red-300 focus:border-red-400',
                                            isRTL && 'pl-16 pr-3',
                                          )}
                                          dir={isRTL ? 'rtl' : 'ltr'}
                                        />
                                        <div className={cn(
                                          'absolute bottom-2 text-xs',
                                          isRTL ? 'left-2' : 'right-2',
                                          (aiBrief || '').length > 1200 ? 'text-red-600 font-semibold' : 'text-slate-500',
                                        )}
                                        >
                                          {(aiBrief || '').length}
                                          /1200
                                        </div>
                                      </div>
                                      {(aiBrief || '').length > 1200 && (
                                        <p className="text-xs text-red-600">
                                          {isRTL
                                            ? 'התיאור ארוך מדי. אנא קיצר אותו ל-1200 תווים או פחות.'
                                            : 'Brief is too long. Please shorten it to 1200 characters or less.'}
                                        </p>
                                      )}
                                    </div>

                                    <div className="space-y-2">
                                      <label className="block text-sm font-semibold text-pink-700">
                                        {isRTL ? 'שפה' : 'Language'}
                                      </label>
                                      <Select
                                        value={aiLanguage || 'en'}
                                        onValueChange={(value) => {
                                          if (value === 'en' || value === 'he') {
                                            setAiLanguage(value);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="w-full border-pink-200 bg-white focus:border-pink-400 focus:ring-pink-400" dir={isRTL ? 'rtl' : 'ltr'}>
                                          <SelectValue
                                            placeholder={isRTL ? 'בחר שפה' : 'Select language'}
                                            selectedLabel={aiLanguage === 'he' ? 'עברית' : aiLanguage === 'en' ? 'English' : undefined}
                                            options={[
                                              { value: 'en', name: 'English' },
                                              { value: 'he', name: 'עברית' },
                                            ]}
                                          />
                                        </SelectTrigger>
                                        <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                                          <SelectItem value="en" dir={isRTL ? 'rtl' : 'ltr'}>English</SelectItem>
                                          <SelectItem value="he" dir={isRTL ? 'rtl' : 'ltr'}>עברית (Hebrew)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className={cn('flex items-center gap-3 justify-end', isRTL && 'flex-row-reverse')}>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                          setShowAiPanel(prev => ({ ...prev, base: false }));
                                        }}
                                        className="text-slate-700 hover:bg-white/50"
                                      >
                                        {t('cancel')}
                                      </Button>
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          void handleGenerateAll(aiBrief || '', aiTone, aiLanguage, aiStyle, firstPlatform || undefined);
                                          setShowAiPanel(prev => ({ ...prev, base: false }));
                                        }}
                                        disabled={isGeneratingAll || !aiBrief?.trim()}
                                        className="gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
                                      >
                                        {isGeneratingAll
                                          ? (
                                              <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                {t('ai_loading')}
                                              </>
                                            )
                                          : (
                                              <>
                                                <Wand2 className="h-4 w-4" />
                                                {isRTL ? 'צור תוכן' : 'Create Content'}
                                              </>
                                            )}
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Title Input - Campaign name or title */}
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700">
                                    {isRTL ? 'כותרת קמפיין (אופציונלי)' : 'Campaign Name / Title (Optional)'}
                                  </label>
                                  <Input
                                    value={postTitle || (firstPlatform ? (platformContent[firstPlatform]?.title || '') : '')}
                                    onChange={(e) => {
                                      const newTitle = e.target.value;
                                      setPostTitle(newTitle);
                                      // Update title for all selected platforms
                                      selectedPlatforms.forEach((platform) => {
                                        setPlatformContent(prev => ({
                                          ...prev,
                                          [platform]: {
                                            ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
                                            title: newTitle,
                                          },
                                        }));
                                      });
                                    }}
                                    placeholder={t('post_title_placeholder')}
                                    className="border-slate-200 bg-white focus:border-pink-400"
                                  />
                                </div>

                                {/* Caption Textarea */}
                                <div className="relative">
                                  <Textarea
                                    ref={captionTextareaRef}
                                    value={editMode === 'unified' && firstPlatform
                                      ? (platformContent[firstPlatform]?.caption || baseCaption || '')
                                      : (baseCaption || (firstPlatform ? (platformContent[firstPlatform]?.caption || '') : ''))}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      if (editMode === 'unified' && firstPlatform) {
                                        handleUnifiedCaptionChange(newValue, firstPlatform);
                                      } else {
                                        // In unified mode by default, copy to all platforms
                                        setBaseCaption(newValue);
                                        selectedPlatforms.forEach((platform) => {
                                          setPlatformContent(prev => ({
                                            ...prev,
                                            [platform]: {
                                              ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
                                              caption: newValue,
                                            },
                                          }));
                                        });
                                      }
                                    }}
                                    placeholder={isRTL ? 'מה בראש שלך? הקלד כאן והתוכן יועתק לכל הפלטפורמות הנבחרות...' : 'What\'s on your mind? Type here and content will be copied to all selected platforms...'}
                                    className={cn(
                                      'min-h-[250px] w-full resize-none border-slate-200 bg-white text-base leading-relaxed focus:border-pink-400 focus:ring-pink-400',
                                      isRTL && 'text-right',
                                    )}
                                  />

                                  {/* Character Count & Emoji Selector */}
                                  <div className={cn(
                                    'absolute bottom-2 flex items-center gap-2 text-xs',
                                    isRTL ? 'left-2' : 'right-2',
                                  )}
                                  >
                                    <span className={cn(
                                      (editMode === 'unified' && firstPlatform
                                        ? (platformContent[firstPlatform]?.caption || baseCaption || '')
                                        : (baseCaption || (firstPlatform ? (platformContent[firstPlatform]?.caption || '') : ''))).length > Math.min(...selectedPlatforms.map(p => PLATFORM_CHARACTER_LIMITS[p]))
                                        ? 'font-semibold text-red-600'
                                        : (editMode === 'unified' && firstPlatform
                                            ? (platformContent[firstPlatform]?.caption || baseCaption || '')
                                            : (baseCaption || (firstPlatform ? (platformContent[firstPlatform]?.caption || '') : ''))).length > Math.min(...selectedPlatforms.map(p => PLATFORM_CHARACTER_LIMITS[p])) * 0.9
                                            ? 'font-medium text-amber-600'
                                            : 'text-slate-500',
                                    )}
                                    >
                                      {(editMode === 'unified' && firstPlatform
                                        ? (platformContent[firstPlatform]?.caption || baseCaption || '')
                                        : (baseCaption || (firstPlatform ? (platformContent[firstPlatform]?.caption || '') : ''))).length}
                                      {' '}
                                      /
                                      {' '}
                                      {selectedPlatforms.length > 0
                                        ? Math.min(...selectedPlatforms.map(p => PLATFORM_CHARACTER_LIMITS[p]))
                                        : 280}
                                    </span>
                                    <Popover open={showEmojiPicker && emojiPickerTarget === 'base'} onOpenChange={setShowEmojiPicker}>
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                          onClick={() => {
                                            setEmojiPickerTarget('base');
                                            setShowEmojiPicker(true);
                                          }}
                                        >
                                          <Smile className="h-3.5 w-3.5" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80 p-2" align={isRTL ? 'end' : 'end'}>
                                        <EmojiPicker onSelect={emoji => insertEmoji(emoji, 'base')} />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>
                              </div>

                              {/* AI Prompt Panel */}
                              {showAiPanel.base && (
                                <div className="space-y-4 rounded-lg border border-pink-200 bg-pink-50/50 p-4">
                                  <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-pink-700">
                                      {isRTL ? 'על מה הפוסט?' : 'What is the post about?'}
                                    </label>
                                    <div className="relative">
                                      <Textarea
                                        value={aiBrief || ''}
                                        onChange={e => setAiBrief(e.target.value)}
                                        placeholder={isRTL
                                          ? 'למשל: השקת מוצר חדש, טיפ מקצועי, סיפור אישי...'
                                          : 'e.g., New product launch, professional tip, personal story...'}
                                        className={cn(
                                          'min-h-[80px] resize-none rounded-lg border-pink-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400 pr-16',
                                          (aiBrief || '').length > 1200 && 'border-red-300 focus:border-red-400',
                                          isRTL && 'pl-16 pr-3',
                                        )}
                                        dir={isRTL ? 'rtl' : 'ltr'}
                                      />
                                      <div className={cn(
                                        'absolute bottom-2 text-xs',
                                        isRTL ? 'left-2' : 'right-2',
                                        (aiBrief || '').length > 1200 ? 'text-red-600 font-semibold' : 'text-slate-500',
                                      )}
                                      >
                                        {(aiBrief || '').length}
                                        /1200
                                      </div>
                                    </div>
                                    {(aiBrief || '').length > 1200 && (
                                      <p className="text-xs text-red-600">
                                        {isRTL
                                          ? 'התיאור ארוך מדי. אנא קיצר אותו ל-1200 תווים או פחות.'
                                          : 'Brief is too long. Please shorten it to 1200 characters or less.'}
                                      </p>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-pink-700">
                                      {isRTL ? 'שפה' : 'Language'}
                                    </label>
                                    <Select
                                      value={aiLanguage || 'en'}
                                      onValueChange={(value) => {
                                        if (value === 'en' || value === 'he') {
                                          setAiLanguage(value);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-full border-pink-200 bg-white focus:border-pink-400 focus:ring-pink-400" dir={isRTL ? 'rtl' : 'ltr'}>
                                        <SelectValue
                                          placeholder={isRTL ? 'בחר שפה' : 'Select language'}
                                          selectedLabel={aiLanguage === 'he' ? 'עברית' : aiLanguage === 'en' ? 'English' : undefined}
                                          options={[
                                            { value: 'en', name: 'English' },
                                            { value: 'he', name: 'עברית' },
                                          ]}
                                        />
                                      </SelectTrigger>
                                      <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                                        <SelectItem value="en" dir={isRTL ? 'rtl' : 'ltr'}>English</SelectItem>
                                        <SelectItem value="he" dir={isRTL ? 'rtl' : 'ltr'}>עברית (Hebrew)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className={cn('flex items-center gap-3 justify-end', isRTL && 'flex-row-reverse')}>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() => {
                                        setShowAiPanel(prev => ({ ...prev, base: false }));
                                      }}
                                      className="text-slate-700 hover:bg-white/50"
                                    >
                                      {t('cancel')}
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        void handleGenerateAll(aiBrief || '', aiTone, aiLanguage, aiStyle);
                                        setShowAiPanel(prev => ({ ...prev, base: false }));
                                      }}
                                      disabled={isGeneratingAll || !aiBrief?.trim()}
                                      className="gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
                                    >
                                      {isGeneratingAll
                                        ? (
                                            <>
                                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                              {t('ai_loading')}
                                            </>
                                          )
                                        : (
                                            <>
                                              <Wand2 className="h-4 w-4" />
                                              {isRTL ? 'צור תוכן' : 'Create Content'}
                                            </>
                                          )}
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Optional Link Field */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                  {isRTL ? 'קישור (אופציונלי)' : 'Link (Optional)'}
                                </label>
                                <div className="relative">
                                  <Input
                                    type="url"
                                    value={mainLink || (firstPlatform ? (platformContent[firstPlatform]?.link || '') : '')}
                                    onChange={(e) => {
                                      const newLink = e.target.value;
                                      setMainLink(newLink);
                                      // Update link for all selected platforms
                                      selectedPlatforms.forEach((platform) => {
                                        setPlatformContent(prev => ({
                                          ...prev,
                                          [platform]: {
                                            ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
                                            link: newLink,
                                          },
                                        }));
                                      });
                                    }}
                                    placeholder={isRTL ? 'https://example.com' : 'https://example.com'}
                                    className={cn(
                                      'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm transition-colors',
                                      'focus:border-pink-400 focus:ring-1 focus:ring-pink-400',
                                      isRTL && 'text-right',
                                    )}
                                  />
                                  <div className={cn(
                                    'absolute top-1/2 -translate-y-1/2 flex items-center justify-center',
                                    isRTL ? 'left-2' : 'right-2',
                                  )}
                                  >
                                    <ExternalLink className="h-4 w-4 text-slate-400" />
                                  </div>
                                </div>
                              </div>

                              {/* Media Upload */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">{t('media_upload_title')}</label>

                                {/* Mode Selection Tabs */}
                                <Tabs
                                  value={mediaMode.base || 'manual'}
                                  onValueChange={value => setMediaMode(prev => ({ ...prev, base: value as 'manual' | 'ai' }))}
                                  className="w-full"
                                >
                                  <TabsList className="grid h-9 w-full grid-cols-2">
                                    <TabsTrigger value="manual" className="text-xs">
                                      {isRTL ? 'העלאה ידנית' : 'Manual Upload'}
                                    </TabsTrigger>
                                    <TabsTrigger value="ai" className="text-xs">
                                      {isRTL ? 'יצירה עם AI' : 'Generate with AI'}
                                    </TabsTrigger>
                                  </TabsList>

                                  {/* Manual Upload Tab */}
                                  <TabsContent value="manual" className="mt-2 space-y-2">
                                    <input
                                      ref={(el) => {
                                        if (el) {
                                          fileInputRefs.current.base = el;
                                        }
                                      }}
                                      type="file"
                                      multiple
                                      accept="image/*,video/*"
                                      onChange={e => handleMediaUpload(e)}
                                      className="hidden"
                                    />

                                    <div
                                      onClick={() => fileInputRefs.current.base?.click()}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          fileInputRefs.current.base?.click();
                                        }
                                      }}
                                      onDrop={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDraggingOver(prev => ({ ...prev, base: false }));

                                        const files = Array.from(e.dataTransfer.files).filter((file) => {
                                          return file.type.startsWith('image/') || file.type.startsWith('video/');
                                        });

                                        if (files.length > 0) {
                                          await processMediaFiles(files);
                                        }
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDraggingOver(prev => ({ ...prev, base: true }));
                                      }}
                                      onDragLeave={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (e.currentTarget === e.target) {
                                          setIsDraggingOver(prev => ({ ...prev, base: false }));
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      className={cn(
                                        'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-pink-400 hover:bg-pink-50/50',
                                        isUploadingMedia && 'pointer-events-none opacity-50',
                                        isDraggingOver.base && 'border-pink-500 bg-pink-100 border-solid',
                                      )}
                                    >
                                      {isUploadingMedia
                                        ? (
                                            <div className="flex flex-col items-center gap-2">
                                              <span className="h-5 w-5 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
                                              <p className="text-xs text-slate-600">{t('uploading_media')}</p>
                                            </div>
                                          )
                                        : (
                                            <>
                                              <ImageIcon className={cn('h-6 w-6 transition-colors', isDraggingOver.base ? 'text-pink-500' : 'text-slate-400')} />
                                              <p className={cn('mt-1 text-xs font-medium transition-colors', isDraggingOver.base ? 'text-pink-700' : 'text-slate-700')}>
                                                {isDraggingOver.base ? (isRTL ? 'שחרר כאן להעלאה' : 'Drop files here') : t('click_to_upload_media')}
                                              </p>
                                              <p className="mt-0.5 text-[10px] text-slate-500">{t('media_upload_hint')}</p>
                                            </>
                                          )}
                                    </div>
                                  </TabsContent>

                                  {/* AI Generation Tab */}
                                  <TabsContent value="ai" className="mt-2 space-y-2">
                                    <div className="space-y-2">
                                      <Textarea
                                        value={aiMediaPrompt.base || ''}
                                        onChange={e => setAiMediaPrompt(prev => ({ ...prev, base: e.target.value }))}
                                        placeholder={isRTL
                                          ? 'תאר את התמונה שברצונך ליצור... (למשל: "חתול חמוד יושב על חלון עם נוף עירוני ברקע")'
                                          : 'Describe the image you want to create... (e.g., "A cute cat sitting on a window with a city skyline in the background")'}
                                        className="min-h-[80px] resize-none rounded-lg border-slate-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400"
                                        dir={isRTL ? 'rtl' : 'ltr'}
                                      />
                                      <Button
                                        type="button"
                                        onClick={async () => {
                                          const prompt = aiMediaPrompt.base?.trim();
                                          if (!prompt) {
                                            setError(isRTL ? 'אנא הזן תיאור לתמונה' : 'Please enter a description for the image');
                                            return;
                                          }

                                          setIsGeneratingMedia(prev => ({ ...prev, base: true }));
                                          setError(null);

                                          try {
                                            const response = await fetch('/api/ai/generate-media', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                prompt,
                                              }),
                                            });

                                            if (!response.ok) {
                                              const errorBody = await response.json().catch(() => ({}));
                                              throw new Error(errorBody?.error || (isRTL ? 'שגיאה ביצירת תמונה' : 'Failed to generate image'));
                                            }

                                            const data = await response.json();
                                            if (data.url) {
                                              setMediaUrls(prev => [...prev, data.url]);
                                              setMediaFiles(prev => [...prev, { url: data.url, type: 'image' }]);
                                              selectedPlatforms.forEach((platform) => {
                                                setPlatformContent(prev => ({
                                                  ...prev,
                                                  [platform]: {
                                                    ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
                                                    mediaUrls: [...(prev[platform]?.mediaUrls || []), data.url],
                                                  },
                                                }));
                                              });
                                              // Clear prompt after successful generation
                                              setAiMediaPrompt(prev => ({ ...prev, base: '' }));
                                            }
                                          } catch (err) {
                                            console.error('[AI Media] Error:', err);
                                            setError(err instanceof Error ? err.message : (isRTL ? 'שגיאה ביצירת תמונה' : 'Failed to generate image'));
                                          } finally {
                                            setIsGeneratingMedia(prev => ({ ...prev, base: false }));
                                          }
                                        }}
                                        disabled={isGeneratingMedia.base || !aiMediaPrompt.base?.trim()}
                                        className="w-full gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
                                      >
                                        {isGeneratingMedia.base
                                          ? (
                                              <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                {isRTL ? 'יוצר תמונה...' : 'Generating image...'}
                                              </>
                                            )
                                          : (
                                              <>
                                                <Wand2 className="h-4 w-4" />
                                                {isRTL ? 'צור תמונה' : 'Generate Image'}
                                              </>
                                            )}
                                      </Button>
                                      <p className="text-center text-[10px] text-slate-500">
                                        {isRTL
                                          ? 'הערה: יצירת וידאו עם AI זמינה בקרוב. כרגע ניתן ליצור תמונות בלבד.'
                                          : 'Note: AI video generation coming soon. Currently only images are supported.'}
                                      </p>
                                    </div>
                                  </TabsContent>
                                </Tabs>

                                {/* Media Preview */}
                                {mediaUrls.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-medium text-slate-600">
                                        {mediaUrls.length}
                                        {' '}
                                        {mediaUrls.length === 1 ? t('media_item') : t('media_items')}
                                      </p>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setMediaUrls([]);
                                          selectedPlatforms.forEach((platform) => {
                                            setPlatformContent(prev => ({
                                              ...prev,
                                              [platform]: {
                                                ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
                                                mediaUrls: [],
                                              },
                                            }));
                                          });
                                        }}
                                        className="h-6 text-[10px] text-red-600 hover:bg-red-50 hover:text-red-700"
                                      >
                                        {t('clear_all')}
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                      {mediaUrls.map((url, idx) => {
                                        const mediaFile = mediaFiles.find(f => f.url === url);
                                        const isVideo = mediaFile?.type === 'video';
                                        return (
                                          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                            {isVideo
                                              ? (
                                                  <div className="flex h-full items-center justify-center bg-black">
                                                    <Play className="h-5 w-5 text-white" />
                                                  </div>
                                                )
                                              : (
                                                  <Image src={url} alt={`Media ${idx + 1}`} fill className="object-cover" />
                                                )}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setMediaUrls(prev => prev.filter(u => u !== url));
                                                selectedPlatforms.forEach((platform) => {
                                                  setPlatformContent(prev => ({
                                                    ...prev,
                                                    [platform]: {
                                                      ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
                                                      mediaUrls: (prev[platform]?.mediaUrls || []).filter(u => u !== url),
                                                    },
                                                  }));
                                                });
                                              }}
                                              className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                            >
                                              <X className="h-2.5 w-2.5" />
                                            </button>
                                            {isVideo && (
                                              <div className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] text-white">
                                                Video
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Hashtags */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                  {isRTL ? 'האשטאגים' : 'Hashtags'}
                                </label>
                                <div className="relative">
                                  <Input
                                    placeholder={t('hashtags_placeholder')}
                                    value={hashtagInput.base || ''}
                                    onChange={e => setHashtagInput(prev => ({ ...prev, base: e.target.value }))}
                                    onKeyDown={(e) => {
                                      const currentInput = hashtagInput.base || '';
                                      if (e.key !== 'Enter' || !currentInput.trim()) {
                                        return;
                                      }
                                      e.preventDefault();
                                      const normalized = currentInput.trim().replace(/^#/, '');
                                      setHashtagInput(prev => ({ ...prev, base: '' }));

                                      // Add hashtag to all selected platforms
                                      selectedPlatforms.forEach((platform) => {
                                        const platformHashtags = platformContent[platform]?.hashtags || [];
                                        if (!platformHashtags.includes(normalized)) {
                                          setPlatformContent(prev => ({
                                            ...prev,
                                            [platform]: {
                                              ...(prev[platform] || { caption: '', title: '', link: '', mediaUrls: [], hashtags: [] }),
                                              hashtags: [...platformHashtags, normalized],
                                            },
                                          }));
                                        }
                                      });
                                    }}
                                    className={cn(
                                      'h-9 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm transition-colors',
                                      'focus:border-pink-400 focus:ring-1 focus:ring-pink-400',
                                      isRTL && 'text-right',
                                    )}
                                  />
                                  <div className={cn(
                                    'absolute top-1/2 -translate-y-1/2 flex items-center justify-center',
                                    isRTL ? 'left-2' : 'right-2',
                                  )}
                                  >
                                    <Hash className="h-4 w-4 text-blue-500" />
                                  </div>
                                </div>
                                {/* Show hashtags from first platform as preview */}
                                {firstPlatform && platformContent[firstPlatform]?.hashtags && platformContent[firstPlatform].hashtags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {platformContent[firstPlatform].hashtags.map(tag => (
                                      <span
                                        key={tag}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700"
                                      >
                                        #
                                        {tag}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // Remove from all platforms
                                            selectedPlatforms.forEach((platform) => {
                                              removeHashtag(tag, platform);
                                            });
                                          }}
                                          className="hover:text-pink-900"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Character Counter */}
                              {selectedPlatforms.length > 0 && (
                                <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <span className="font-medium">
                                      {(editMode === 'unified' && firstPlatform
                                        ? (platformContent[firstPlatform]?.caption || baseCaption || '')
                                        : (baseCaption || (firstPlatform ? (platformContent[firstPlatform]?.caption || '') : ''))).length}
                                    </span>
                                    <span className="text-slate-400">/</span>
                                    <span>
                                      {selectedPlatforms.length > 0
                                        ? Math.min(...selectedPlatforms.map(p => PLATFORM_CHARACTER_LIMITS[p]))
                                        : 280}
                                    </span>
                                    {selectedPlatforms.length > 1 && (
                                      <span className="text-xs text-slate-400">
                                        (
                                        {isRTL ? 'משותף ל' : 'shared with'}
                                        {' '}
                                        {selectedPlatforms.length}
                                        {' '}
                                        {isRTL ? 'פלטפורמות' : 'platforms'}
                                        )
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {selectedPlatforms.map((platform) => {
                                      const Icon = PLATFORM_ICON_CONFIG[platform]?.icon;
                                      return Icon
                                        ? (
                                            <div
                                              key={platform}
                                              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white"
                                              title={PLATFORM_ICON_CONFIG[platform]?.name}
                                            >
                                              <Icon className="h-3.5 w-3.5 text-slate-600" />
                                            </div>
                                          )
                                        : null;
                                    })}
                                  </div>
                                </div>
                              )}
                              {/* Platform Validation Errors */}
                              {selectedPlatforms.length > 0 && Object.keys(platformValidationErrors).some(platform =>
                                platformValidationErrors[platform as Platform]?.length > 0,
                              ) && (
                                <div className="mt-4 space-y-2">
                                  {selectedPlatforms.map((platform) => {
                                    const platformErrors = platformValidationErrors[platform] || [];
                                    if (platformErrors.length === 0) {
                                      return null;
                                    }

                                    const Icon = PLATFORM_ICON_CONFIG[platform]?.icon;
                                    const config = PLATFORM_ICON_CONFIG[platform];

                                    return (
                                      <div
                                        key={platform}
                                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm"
                                      >
                                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                                        <div className="min-w-0 flex-1">
                                          <div className="mb-1 flex items-center gap-2">
                                            {Icon && (
                                              <div className={cn('flex h-5 w-5 items-center justify-center rounded', config.bg)}>
                                                <Icon className="h-3 w-3 text-white" />
                                              </div>
                                            )}
                                            <span className="font-semibold text-red-900">
                                              {config.name}
                                            </span>
                                          </div>
                                          <ul className="list-inside list-disc space-y-0.5 text-red-700">
                                            {platformErrors.map((error, idx) => (
                                              <li key={idx}>{error}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Platform-Specific Content (Only shown in per-platform mode or for advanced options) */}
                        {editMode === 'per-platform' && selectedPlatforms.length > 0 && (
                          <Card className="border-0 shadow-lg">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                <Pencil className="h-5 w-5 text-pink-500" />
                                {isRTL ? 'עריכה לפי פלטפורמה' : 'Edit by Platform'}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Tabs
                                value={activePerPlatformTab || selectedPlatforms[0]}
                                onValueChange={value => setActivePerPlatformTab(value as Platform)}
                                className="w-full"
                              >
                                <TabsList className="mb-4 flex h-auto w-full justify-start gap-1 overflow-x-auto bg-slate-50 p-1">
                                  {selectedPlatforms.map((platform) => {
                                    const config = PLATFORM_ICON_CONFIG[platform];
                                    const Icon = config.icon;
                                    const selectedFormats = Array.from(formatMap.get(platform) ?? []);
                                    const isSelected = selectedFormats.length > 0;

                                    return (
                                      <TabsTrigger
                                        key={platform}
                                        value={platform}
                                        className={cn(
                                          'flex h-auto items-center justify-center gap-2 p-2 data-[state=active]:bg-white data-[state=active]:shadow-sm',
                                          isSelected && 'data-[state=active]:border-pink-500',
                                        )}
                                        title={config.name}
                                      >
                                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg)}>
                                          <Icon className="h-4 w-4 text-white" />
                                        </div>
                                        <span className="hidden text-xs font-medium text-slate-700 sm:inline">
                                          {config.name}
                                        </span>
                                        {isSelected && selectedFormats[0] && (
                                          <span className="hidden rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-medium text-white md:inline-flex">
                                            {FORMAT_LABELS[selectedFormats[0] as Format]}
                                          </span>
                                        )}
                                      </TabsTrigger>
                                    );
                                  })}
                                </TabsList>

                                <div className="space-y-4">
                                  {selectedPlatforms.map((platform) => {
                                    const selectedFormats = Array.from(formatMap.get(platform) ?? []);
                                    const isSelected = selectedFormats.length > 0;
                                    const availableFormats = platformFormats[platform] || [];
                                    const platformContentData = platformContent[platform] || { caption: baseCaption, title: postTitle, link: mainLink, mediaUrls: [] };
                                    const platformMediaUrls = platformContentData.mediaUrls.length > 0 ? platformContentData.mediaUrls : mediaUrls;
                                    const platformMediaFiles = mediaFiles.filter(f => platformMediaUrls.includes(f.url));
                                    const limit = PLATFORM_CHARACTER_LIMITS[platform];

                                    return (
                                      <TabsContent key={platform} value={platform} className="mt-0 space-y-4">
                                        {/* Post Type Selection */}
                                        {isSelected && availableFormats.length > 0 && (
                                          <div className={cn('space-y-2', isRTL && 'text-right')}>
                                            <label className="block text-sm font-semibold text-slate-900">
                                              {isRTL ? 'בחר סוג פוסט:' : 'Select Post Type:'}
                                            </label>
                                            <Popover
                                              open={openPostTypePopovers[platform] || false}
                                              onOpenChange={open => setOpenPostTypePopovers(prev => ({ ...prev, [platform]: open }))}
                                            >
                                              <PopoverTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className={cn(
                                                    'w-full h-9 border-slate-300 bg-white text-sm justify-between',
                                                    isRTL && 'flex-row-reverse',
                                                  )}
                                                >
                                                  <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                                                    <ImageIcon className="h-4 w-4 text-slate-600" />
                                                    <span>
                                                      {selectedFormats.length > 0 && selectedFormats[0]
                                                        ? FORMAT_LABELS[selectedFormats[0]]
                                                        : t('select_post_type_placeholder')}
                                                    </span>
                                                  </div>
                                                  <ChevronDown className={cn('h-4 w-4 text-slate-400', isRTL && 'rotate-180')} />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-56 p-2" align={isRTL ? 'end' : 'start'}>
                                                <div className="space-y-1">
                                                  {availableFormats.map((format) => {
                                                    const isFormatSelected = selectedFormats.includes(format);
                                                    const validation = isFormatValid(
                                                      platform,
                                                      format,
                                                      platformMediaUrls.length,
                                                      platformMediaFiles.some(f => f.type === 'video'),
                                                      platformMediaFiles,
                                                    );
                                                    const isDisabled = !validation.valid;

                                                    return (
                                                      <button
                                                        key={`${platform}-${format}`}
                                                        type="button"
                                                        onClick={() => {
                                                          if (!isDisabled) {
                                                            handleToggleFormat(platform, format);
                                                            setOpenPostTypePopovers(prev => ({ ...prev, [platform]: false }));
                                                          }
                                                        }}
                                                        disabled={isDisabled}
                                                        className={cn(
                                                          'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                                                          isDisabled
                                                            ? 'cursor-not-allowed opacity-50'
                                                            : 'hover:bg-slate-100',
                                                          isFormatSelected && !isDisabled && 'bg-pink-50 text-pink-700',
                                                        )}
                                                        title={validation.reason}
                                                      >
                                                        <div className={cn(
                                                          'flex h-4 w-4 items-center justify-center rounded border mt-0.5 shrink-0',
                                                          isFormatSelected && !isDisabled ? 'border-pink-500 bg-pink-500' : 'border-slate-300',
                                                        )}
                                                        >
                                                          {isFormatSelected && !isDisabled && <Check className="h-3 w-3 text-white" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                          <div className="flex items-center gap-1">
                                                            <span>{FORMAT_LABELS[format]}</span>
                                                            {isDisabled && (
                                                              <span className="text-xs text-slate-400">
                                                                (
                                                                {t('requires_media')}
                                                                )
                                                              </span>
                                                            )}
                                                          </div>
                                                          {isDisabled && validation.reason && (
                                                            <p className="mt-0.5 text-xs text-slate-500">{validation.reason}</p>
                                                          )}
                                                        </div>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                        )}

                                        {/* Content Fields */}
                                        {isSelected && (
                                          <div className={cn('space-y-4', isRTL && 'space-y-reverse')}>
                                            {/* Title Input - Only for platforms that support it */}
                                            {(platform === 'youtube' || platform === 'linkedin') && (
                                              <Input
                                                value={platformContentData.title}
                                                onChange={e => setPlatformContent(prev => ({
                                                  ...prev,
                                                  [platform]: { ...prev[platform], title: e.target.value },
                                                }))}
                                                placeholder={t('post_title_placeholder')}
                                                className="border-slate-200 bg-white focus:border-pink-400"
                                              />
                                            )}

                                            {/* Caption Textarea with AI Button */}
                                            <div className="relative flex gap-3">
                                              {/* AI Generate Button - Positioned to the left (right in RTL) */}
                                              <div className={cn('flex items-start pt-2', isRTL && 'order-2')}>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    setShowAiPanel(prev => ({ ...prev, [platform]: !prev[platform] }));
                                                    if (!aiBriefInput[platform]) {
                                                      setAiBriefInput(prev => ({ ...prev, [platform]: aiBrief || platformContentData.caption || '' }));
                                                    }
                                                    if (!aiToneInput[platform]) {
                                                      setAiToneInput(prev => ({ ...prev, [platform]: aiTone }));
                                                    }
                                                    if (!aiLanguageInput[platform]) {
                                                      setAiLanguageInput(prev => ({ ...prev, [platform]: aiLanguage }));
                                                    }
                                                    if (!aiStyleInput[platform]) {
                                                      setAiStyleInput(prev => ({ ...prev, [platform]: aiStyle }));
                                                    }
                                                  }}
                                                  className={cn(
                                                    'h-8 gap-1.5 text-xs border-pink-300 text-pink-600 hover:bg-pink-50 whitespace-nowrap',
                                                    showAiPanel[platform] && 'bg-pink-50',
                                                  )}
                                                >
                                                  <Wand2 className="h-3.5 w-3.5" />
                                                  {isRTL ? 'צור באמצעות AI' : 'Create with AI'}
                                                </Button>
                                              </div>

                                              {/* Textarea */}
                                              <div className={cn('relative flex-1', isRTL && 'order-1')}>
                                                <Textarea
                                                  data-platform={platform}
                                                  value={platformContentData.caption}
                                                  onChange={e => setPlatformContent(prev => ({
                                                    ...prev,
                                                    [platform]: { ...prev[platform], caption: e.target.value },
                                                  }))}
                                                  placeholder={t('content_placeholder')}
                                                  className="min-h-[120px] resize-none border-slate-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400"
                                                />

                                                {/* Character Count & Emoji Selector */}
                                                <div className={cn(
                                                  'absolute bottom-2 flex items-center gap-2 text-xs',
                                                  isRTL ? 'left-2' : 'right-2',
                                                )}
                                                >
                                                  <span className={cn(
                                                    platformContentData.caption.length > limit
                                                      ? 'font-semibold text-red-600'
                                                      : platformContentData.caption.length > limit * 0.9
                                                        ? 'font-medium text-amber-600'
                                                        : 'text-slate-500',
                                                  )}
                                                  >
                                                    {platformContentData.caption.length}
                                                    {' '}
                                                    /
                                                    {limit.toLocaleString()}
                                                  </span>
                                                  <Popover open={showEmojiPicker && emojiPickerTarget === platform} onOpenChange={setShowEmojiPicker}>
                                                    <PopoverTrigger asChild>
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                                        onClick={() => {
                                                          setEmojiPickerTarget(platform);
                                                          setShowEmojiPicker(true);
                                                        }}
                                                      >
                                                        <Smile className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 p-2" align={isRTL ? 'end' : 'end'}>
                                                      <EmojiPicker onSelect={emoji => insertEmoji(emoji, platform)} />
                                                    </PopoverContent>
                                                  </Popover>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Optional Link Field - Right after caption for all platforms */}
                                            <div className="space-y-2">
                                              <label className="text-xs font-medium text-slate-700">
                                                {isRTL ? 'קישור (אופציונלי)' : 'Link (Optional)'}
                                              </label>
                                              <div className="relative">
                                                <Input
                                                  type="url"
                                                  value={platformContentData.link || ''}
                                                  onChange={e => setPlatformContent(prev => ({
                                                    ...prev,
                                                    [platform]: { ...prev[platform], link: e.target.value },
                                                  }))}
                                                  placeholder={isRTL ? 'https://example.com' : 'https://example.com'}
                                                  className={cn(
                                                    'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm transition-colors',
                                                    'focus:border-pink-400 focus:ring-1 focus:ring-pink-400',
                                                    isRTL && 'text-right',
                                                  )}
                                                />
                                                <div className={cn(
                                                  'absolute top-1/2 -translate-y-1/2 flex items-center justify-center',
                                                  isRTL ? 'left-2' : 'right-2',
                                                )}
                                                >
                                                  <ExternalLink className="h-4 w-4 text-slate-400" />
                                                </div>
                                              </div>
                                            </div>

                                            {/* AI Prompt Panel - Inline at bottom */}
                                            {showAiPanel[platform] && (
                                              <div className="space-y-4 rounded-lg border border-pink-200 bg-pink-50/50 p-4">
                                                <div className="space-y-2">
                                                  <label className="block text-sm font-semibold text-pink-700">
                                                    {isRTL ? 'על מה הפוסט?' : 'What is the post about?'}
                                                  </label>
                                                  <div className="relative">
                                                    <Textarea
                                                      value={aiBriefInput[platform] || ''}
                                                      onChange={e => setAiBriefInput(prev => ({ ...prev, [platform]: e.target.value }))}
                                                      placeholder={isRTL
                                                        ? 'למשל: השקת מוצר חדש, טיפ מקצועי, סיפור אישי...'
                                                        : 'e.g., New product launch, professional tip, personal story...'}
                                                      className={cn(
                                                        'min-h-[80px] resize-none rounded-lg border-pink-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400 pr-16',
                                                        (aiBriefInput[platform] || '').length > 1200 && 'border-red-300 focus:border-red-400',
                                                        isRTL && 'pl-16 pr-3',
                                                      )}
                                                      dir={isRTL ? 'rtl' : 'ltr'}
                                                    />
                                                    <div className={cn(
                                                      'absolute bottom-2 text-xs',
                                                      isRTL ? 'left-2' : 'right-2',
                                                      (aiBriefInput[platform] || '').length > 1200 ? 'text-red-600 font-semibold' : 'text-slate-500',
                                                    )}
                                                    >
                                                      {(aiBriefInput[platform] || '').length}
                                                      /1200
                                                    </div>
                                                  </div>
                                                  {(aiBriefInput[platform] || '').length > 1200 && (
                                                    <p className="text-xs text-red-600">
                                                      {isRTL
                                                        ? 'התיאור ארוך מדי. אנא קיצר אותו ל-1200 תווים או פחות.'
                                                        : 'Brief is too long. Please shorten it to 1200 characters or less.'}
                                                    </p>
                                                  )}
                                                </div>

                                                <div className="space-y-2">
                                                  <label className="block text-sm font-semibold text-pink-700">
                                                    {isRTL ? 'שפה' : 'Language'}
                                                  </label>
                                                  <Select
                                                    value={aiLanguageInput[platform] || aiLanguage || 'en'}
                                                    onValueChange={(value) => {
                                                      if (value === 'en' || value === 'he') {
                                                        setAiLanguageInput(prev => ({ ...prev, [platform]: value }));
                                                      }
                                                    }}
                                                  >
                                                    <SelectTrigger className="w-full border-pink-200 bg-white focus:border-pink-400 focus:ring-pink-400" dir={isRTL ? 'rtl' : 'ltr'}>
                                                      <SelectValue
                                                        placeholder={isRTL ? 'בחר שפה' : 'Select language'}
                                                        selectedLabel={aiLanguageInput[platform] === 'he' ? 'עברית' : aiLanguageInput[platform] === 'en' ? 'English' : undefined}
                                                        options={[
                                                          { value: 'en', name: 'English' },
                                                          { value: 'he', name: 'עברית' },
                                                        ]}
                                                      />
                                                    </SelectTrigger>
                                                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                                                      <SelectItem value="en" dir={isRTL ? 'rtl' : 'ltr'}>English</SelectItem>
                                                      <SelectItem value="he" dir={isRTL ? 'rtl' : 'ltr'}>עברית (Hebrew)</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </div>

                                                <div className={cn('flex items-center gap-3 justify-end', isRTL && 'flex-row-reverse')}>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                      setShowAiPanel(prev => ({ ...prev, [platform]: false }));
                                                    }}
                                                    className="text-slate-700 hover:bg-white/50"
                                                  >
                                                    {t('cancel')}
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    onClick={() => {
                                                      void handleGenerateAll(
                                                        aiBriefInput[platform] || '',
                                                        aiToneInput[platform] || aiTone,
                                                        aiLanguageInput[platform] || aiLanguage,
                                                        aiStyleInput[platform] || aiStyle,
                                                        platform,
                                                      );
                                                      setShowAiPanel(prev => ({ ...prev, [platform]: false }));
                                                    }}
                                                    disabled={isGeneratingAll || !aiBriefInput[platform]?.trim()}
                                                    className="gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
                                                  >
                                                    {isGeneratingAll
                                                      ? (
                                                          <>
                                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                            {t('ai_loading')}
                                                          </>
                                                        )
                                                      : (
                                                          <>
                                                            <Wand2 className="h-4 w-4" />
                                                            {isRTL ? 'צור תוכן' : 'Create Content'}
                                                          </>
                                                        )}
                                                  </Button>
                                                </div>
                                              </div>
                                            )}

                                            {/* Media Upload - Per Platform */}
                                            <div className="space-y-2">
                                              <label className="text-xs font-medium text-slate-700">{t('media_upload_title')}</label>

                                              {/* Mode Selection Tabs */}
                                              <Tabs
                                                value={mediaMode[platform] || 'manual'}
                                                onValueChange={value => setMediaMode(prev => ({ ...prev, [platform]: value as 'manual' | 'ai' }))}
                                                className="w-full"
                                              >
                                                <TabsList className="grid h-9 w-full grid-cols-2">
                                                  <TabsTrigger value="manual" className="text-xs">
                                                    {isRTL ? 'העלאה ידנית' : 'Manual Upload'}
                                                  </TabsTrigger>
                                                  <TabsTrigger value="ai" className="text-xs">
                                                    {isRTL ? 'יצירה עם AI' : 'Generate with AI'}
                                                  </TabsTrigger>
                                                </TabsList>

                                                {/* Manual Upload Tab */}
                                                <TabsContent value="manual" className="mt-2 space-y-2">
                                                  <input
                                                    ref={(el) => {
                                                      if (el) {
                                                        fileInputRefs.current[platform] = el;
                                                      }
                                                    }}
                                                    type="file"
                                                    multiple
                                                    accept="image/*,video/*"
                                                    onChange={e => handleMediaUpload(e, platform)}
                                                    className="hidden"
                                                  />

                                                  <div
                                                    onClick={() => fileInputRefs.current[platform]?.click()}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        fileInputRefs.current[platform]?.click();
                                                      }
                                                    }}
                                                    onDrop={e => handleDrop(e, platform)}
                                                    onDragOver={e => handleDragOver(e, platform)}
                                                    onDragLeave={e => handleDragLeave(e, platform)}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={cn(
                                                      'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-pink-400 hover:bg-pink-50/50',
                                                      isUploadingMedia && 'pointer-events-none opacity-50',
                                                      isDraggingOver[platform] && 'border-pink-500 bg-pink-100 border-solid',
                                                    )}
                                                  >
                                                    {isUploadingMedia
                                                      ? (
                                                          <div className="flex flex-col items-center gap-2">
                                                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
                                                            <p className="text-xs text-slate-600">{t('uploading_media')}</p>
                                                          </div>
                                                        )
                                                      : (
                                                          <>
                                                            <ImageIcon className={cn('h-6 w-6 transition-colors', isDraggingOver[platform] ? 'text-pink-500' : 'text-slate-400')} />
                                                            <p className={cn('mt-1 text-xs font-medium transition-colors', isDraggingOver[platform] ? 'text-pink-700' : 'text-slate-700')}>
                                                              {isDraggingOver[platform] ? (isRTL ? 'שחרר כאן להעלאה' : 'Drop files here') : t('click_to_upload_media')}
                                                            </p>
                                                            <p className="mt-0.5 text-[10px] text-slate-500">{t('media_upload_hint')}</p>
                                                          </>
                                                        )}
                                                  </div>
                                                </TabsContent>

                                                {/* AI Generation Tab */}
                                                <TabsContent value="ai" className="mt-2 space-y-2">
                                                  <div className="space-y-2">
                                                    <Textarea
                                                      value={aiMediaPrompt[platform] || ''}
                                                      onChange={e => setAiMediaPrompt(prev => ({ ...prev, [platform]: e.target.value }))}
                                                      placeholder={isRTL
                                                        ? 'תאר את התמונה שברצונך ליצור... (למשל: "חתול חמוד יושב על חלון עם נוף עירוני ברקע")'
                                                        : 'Describe the image you want to create... (e.g., "A cute cat sitting on a window with a city skyline in the background")'}
                                                      className="min-h-[80px] resize-none rounded-lg border-slate-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400"
                                                      dir={isRTL ? 'rtl' : 'ltr'}
                                                    />
                                                    <Button
                                                      type="button"
                                                      onClick={() => void handleGenerateAIMedia(platform)}
                                                      disabled={isGeneratingMedia[platform] || !aiMediaPrompt[platform]?.trim()}
                                                      className="w-full gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700"
                                                    >
                                                      {isGeneratingMedia[platform]
                                                        ? (
                                                            <>
                                                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                              {isRTL ? 'יוצר תמונה...' : 'Generating image...'}
                                                            </>
                                                          )
                                                        : (
                                                            <>
                                                              <Wand2 className="h-4 w-4" />
                                                              {isRTL ? 'צור תמונה' : 'Generate Image'}
                                                            </>
                                                          )}
                                                    </Button>
                                                    <p className="text-center text-[10px] text-slate-500">
                                                      {isRTL
                                                        ? 'הערה: יצירת וידאו עם AI זמינה בקרוב. כרגע ניתן ליצור תמונות בלבד.'
                                                        : 'Note: AI video generation coming soon. Currently only images are supported.'}
                                                    </p>
                                                  </div>
                                                </TabsContent>
                                              </Tabs>

                                              {/* Media Preview */}
                                              {platformMediaUrls.length > 0 && (
                                                <div className="space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <p className="text-xs font-medium text-slate-600">
                                                      {platformMediaUrls.length}
                                                      {' '}
                                                      {platformMediaUrls.length === 1 ? t('media_item') : t('media_items')}
                                                    </p>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => {
                                                        setPlatformContent(prev => ({
                                                          ...prev,
                                                          [platform]: { ...prev[platform], mediaUrls: [] },
                                                        }));
                                                      }}
                                                      className="h-6 text-[10px] text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    >
                                                      {t('clear_all')}
                                                    </Button>
                                                  </div>
                                                  <div className="grid grid-cols-4 gap-2">
                                                    {platformMediaUrls.map((url, idx) => {
                                                      const mediaFile = platformMediaFiles.find(f => f.url === url);
                                                      const isVideo = mediaFile?.type === 'video';
                                                      return (
                                                        <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                                          {isVideo
                                                            ? (
                                                                <div className="flex h-full items-center justify-center bg-black">
                                                                  <Play className="h-5 w-5 text-white" />
                                                                </div>
                                                              )
                                                            : (
                                                                <Image src={url} alt={`Media ${idx + 1}`} fill className="object-cover" />
                                                              )}
                                                          <button
                                                            type="button"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setPlatformContent(prev => ({
                                                                ...prev,
                                                                [platform]: { ...prev[platform], mediaUrls: prev[platform]?.mediaUrls.filter(u => u !== url) || [] },
                                                              }));
                                                            }}
                                                            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                          >
                                                            <X className="h-2.5 w-2.5" />
                                                          </button>
                                                          {isVideo && (
                                                            <div className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] text-white">
                                                              Video
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                  {/* Content Type Detection Info */}
                                                  {selectedFormats.length > 0 && (
                                                    <div className="rounded-lg bg-blue-50 p-2">
                                                      <p className="text-xs text-blue-700">
                                                        {platformMediaUrls.length === 0
                                                          ? t('content_type_text_post')
                                                          : platformMediaFiles.some(f => f.type === 'video')
                                                            ? t('content_type_video')
                                                            : platformMediaUrls.length === 1
                                                              ? t('content_type_single_image')
                                                              : t('content_type_carousel')}
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            {/* Hashtags and Link Fields - Grouped together */}
                                            <div className="space-y-3">
                                              {/* Hashtags */}
                                              <div className="space-y-2">
                                                <div className="relative">
                                                  <Input
                                                    placeholder={t('hashtags_placeholder')}
                                                    value={hashtagInput[platform] || ''}
                                                    onChange={e => setHashtagInput(prev => ({ ...prev, [platform]: e.target.value }))}
                                                    onKeyDown={e => addHashtag(e, platform)}
                                                    className={cn(
                                                      'h-9 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm transition-colors',
                                                      'focus:border-pink-400 focus:ring-1 focus:ring-pink-400',
                                                      isRTL && 'text-right',
                                                    )}
                                                  />
                                                  <div className={cn(
                                                    'absolute top-1/2 -translate-y-1/2 flex items-center justify-center',
                                                    isRTL ? 'left-2' : 'right-2',
                                                  )}
                                                  >
                                                    <Hash className="h-4 w-4 text-blue-500" />
                                                  </div>
                                                </div>
                                                {platformContentData.hashtags && platformContentData.hashtags.length > 0 && (
                                                  <div className="flex flex-wrap gap-2">
                                                    {platformContentData.hashtags.map(tag => (
                                                      <span
                                                        key={tag}
                                                        className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700"
                                                      >
                                                        #
                                                        {tag}
                                                        <button
                                                          type="button"
                                                          onClick={() => removeHashtag(tag, platform)}
                                                          className="hover:text-pink-900"
                                                        >
                                                          <X className="h-2.5 w-2.5" />
                                                        </button>
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            {/* Platform Validation Errors */}
                                            {platformValidationErrors[platform] && platformValidationErrors[platform].length > 0 && (
                                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                                                <div className="flex items-start gap-2">
                                                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                                                  <div className="min-w-0 flex-1">
                                                    <p className="mb-1 text-xs font-semibold text-red-900">
                                                      {isRTL ? 'שגיאות אימות:' : 'Validation Errors:'}
                                                    </p>
                                                    <ul className="list-inside list-disc space-y-0.5 text-xs text-red-700">
                                                      {platformValidationErrors[platform].map((error, idx) => (
                                                        <li key={idx}>{error}</li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </TabsContent>
                                    );
                                  })}
                                </div>
                              </Tabs>
                            </CardContent>
                          </Card>
                        )}

                        {/* Error Display */}
                        {error && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                            {error}
                          </div>
                        )}
                      </div>

                      {/* Right Panel - Preview (Half Width) */}
                      <div className="hidden lg:block">
                        <Card className="sticky top-6 border-0 shadow-lg">
                          <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base font-semibold text-slate-900">
                              {isRTL ? 'תצוגה מקדימה' : 'Preview'}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewDevice('mobile')}
                                className={cn(
                                  'h-8 w-8 p-0',
                                  previewDevice === 'mobile' ? 'bg-slate-100' : '',
                                )}
                              >
                                <Smartphone className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewDevice('desktop')}
                                className={cn(
                                  'h-8 w-8 p-0',
                                  previewDevice === 'desktop' ? 'bg-slate-100' : '',
                                )}
                              >
                                <Monitor className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {selectedPlatforms.length > 0
                              ? (
                                  <div className="space-y-4">
                                    {/* Platform Tabs */}
                                    {selectedPlatforms.length > 1 && (
                                      <div className="flex gap-2 overflow-x-auto pb-2">
                                        {selectedPlatforms.map((platform) => {
                                          const Icon = PLATFORM_ICON_CONFIG[platform]?.icon;
                                          const config = PLATFORM_ICON_CONFIG[platform];
                                          const isActive = activePlatformTab === platform;
                                          return (
                                            <button
                                              key={platform}
                                              type="button"
                                              onClick={() => setActivePlatformTab(platform)}
                                              className={cn(
                                                'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                                isActive
                                                  ? 'border-pink-500 bg-pink-50 text-pink-700'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                              )}
                                            >
                                              {Icon && (
                                                <div className={cn('flex h-4 w-4 items-center justify-center rounded', config.bg)}>
                                                  <Icon className="h-2.5 w-2.5 text-white" />
                                                </div>
                                              )}
                                              {/* <span>{config.name}</span> */}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Preview for active platform */}
                                    {activePlatformTab
                                      ? (
                                          <PreviewCard
                                            platform={activePlatformTab}
                                            accounts={accounts}
                                            variants={variants}
                                            platformFormats={platformFormats}
                                            platformContent={platformContent}
                                            baseCaption={baseCaption}
                                            postTitle={postTitle}
                                            mainLink={mainLink}
                                            mediaUrls={mediaUrls}
                                            previewDevice={previewDevice}
                                            t={t}
                                          />
                                        )
                                      : selectedPlatforms.length > 0 && firstPlatform
                                        ? (
                                            <PreviewCard
                                              platform={firstPlatform}
                                              accounts={accounts}
                                              variants={variants}
                                              platformFormats={platformFormats}
                                              platformContent={platformContent}
                                              baseCaption={baseCaption}
                                              postTitle={postTitle}
                                              mainLink={mainLink}
                                              mediaUrls={mediaUrls}
                                              previewDevice={previewDevice}
                                              t={t}
                                            />
                                          )
                                        : null}
                                  </div>
                                )
                              : (
                                  <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                                    <p className="text-sm text-slate-500">{isRTL ? 'בחר פלטפורמה לתצוגה מקדימה' : 'Select a platform to preview'}</p>
                                  </div>
                                )}
                            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                              <div className="flex items-start gap-2">
                                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                  {isRTL
                                    ? 'תצוגות מקדימות הן קירוב של איך שהפוסט שלך ייראה כשהוא יתפרסם. הפוסט הסופי עשוי להיראות מעט שונה.'
                                    : 'Previews are an approximation of how your post will look when published. The final post may look slightly different.'}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Bottom Actions - Full Width Footer (Below both panels) */}
                    <div className="sticky bottom-0 z-10 -mx-6 border-t border-slate-200 bg-white px-6 py-4 shadow-lg">
                      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
                        {/* Left: Cancel Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => router.back()}
                          className="text-slate-600 hover:bg-slate-100"
                        >
                          {t('cancel')}
                        </Button>

                        {/* Center: Schedule Options & Preview */}
                        <div className="flex flex-1 items-center justify-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowPreviewModal(true)}
                            className="h-8 gap-1.5 border-slate-300 px-3 text-sm"
                          >
                            <Monitor className="h-3.5 w-3.5" />
                            {t('preview_button')}
                          </Button>

                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setScheduleMode('now')}
                              className={cn(
                                'h-8 gap-1.5 px-3 text-sm transition-all',
                                scheduleMode === 'now'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-600 hover:bg-white/50',
                              )}
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {t('publish_now')}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setScheduleMode('later')}
                              className={cn(
                                'h-8 gap-1.5 px-3 text-sm transition-all',
                                scheduleMode === 'later'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-600 hover:bg-white/50',
                              )}
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              {t('schedule_post')}
                            </Button>
                          </div>

                          {scheduleMode === 'later' && (
                            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                              <label className="text-xs font-medium text-slate-700">
                                {t('schedule_select_datetime')}
                              </label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="date"
                                  min={new Date().toISOString().split('T')[0]}
                                  value={scheduledTime ? scheduledTime.split('T')[0] : ''}
                                  onChange={(e) => {
                                    const date = e.target.value;
                                    const time = scheduledTime ? scheduledTime.split('T')[1] : '00:00';
                                    setScheduledTime(date && time ? `${date}T${time}` : date);
                                  }}
                                  className="h-9 flex-1 border-slate-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400"
                                />
                                <Input
                                  type="time"
                                  value={scheduledTime ? scheduledTime.split('T')[1] : ''}
                                  onChange={(e) => {
                                    const time = e.target.value;
                                    const date = scheduledTime ? scheduledTime.split('T')[0] : new Date().toISOString().split('T')[0];
                                    if (time) {
                                      // Validate: must be at least 5 minutes from now if today
                                      const selectedDateTime = new Date(`${date}T${time}`);
                                      const minDateTime = new Date(Date.now() + 5 * 60000);
                                      if (selectedDateTime < minDateTime && date === new Date().toISOString().split('T')[0]) {
                                        // Set to minimum time if selecting today
                                        const minTime = minDateTime.toTimeString().slice(0, 5);
                                        setScheduledTime(`${date}T${minTime}`);
                                        return;
                                      }
                                      setScheduledTime(`${date}T${time}`);
                                    } else if (date) {
                                      setScheduledTime(date);
                                    }
                                  }}
                                  className="h-9 w-32 border-slate-200 bg-white text-sm focus:border-pink-400 focus:ring-pink-400"
                                />
                              </div>
                              {scheduledTime && (
                                <p className="text-xs text-slate-500">
                                  {t('schedule_hint')}
                                  :
                                  {new Date(scheduledTime).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', {
                                    dateStyle: 'full',
                                    timeStyle: 'short',
                                  })}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: Submit Button */}
                        <Button
                          type="submit"
                          disabled={
                            !isPlatformSelected
                            || isSubmitting
                            || !selectedPlatforms.some((platform) => {
                              const platformContentData = platformContent[platform];
                              return platformContentData?.caption?.trim() || baseCaption.trim();
                            })
                          }
                          className="min-w-[140px] bg-pink-600 hover:bg-pink-700 disabled:opacity-50"
                        >
                          {isSubmitting
                            ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  {scheduleMode === 'now' ? t('publishing') : t('scheduling')}
                                </div>
                              )
                            : (
                                <>
                                  {scheduleMode === 'now' ? t('publish_now') : t('schedule_post')}
                                </>
                              )}
                        </Button>
                      </div>
                    </div>

                    {/* Preview Modal */}
                    <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
                      <DialogContent className="mx-auto my-auto flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
                        <DialogClose />
                        <DialogHeader>
                          <div className="flex items-center justify-between">
                            <DialogTitle className="text-lg font-semibold text-slate-900">
                              {t('preview_title')}
                            </DialogTitle>
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                              <button
                                type="button"
                                onClick={() => setPreviewDevice('mobile')}
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded transition-colors',
                                  previewDevice === 'mobile' ? 'bg-slate-900 text-white' : 'text-slate-600',
                                )}
                              >
                                <Smartphone className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewDevice('desktop')}
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded transition-colors',
                                  previewDevice === 'desktop' ? 'bg-slate-900 text-white' : 'text-slate-600',
                                )}
                              >
                                <Monitor className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </DialogHeader>

                        {selectedPlatforms.length === 0
                          ? (
                              <div className="mt-4 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                                <p className="text-sm text-slate-500">{t('preview_empty')}</p>
                              </div>
                            )
                          : (
                              <Tabs defaultValue={selectedPlatforms[0]} className="mt-4 flex flex-1 flex-col overflow-hidden">
                                <TabsList className="mb-4 flex h-auto w-full justify-center gap-1 bg-slate-50 p-1">
                                  {selectedPlatforms.map((platform) => {
                                    const config = PLATFORM_ICON_CONFIG[platform];
                                    const Icon = config.icon;
                                    return (
                                      <TabsTrigger
                                        key={platform}
                                        value={platform}
                                        className="flex h-auto items-center justify-center p-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                        title={config.name}
                                      >
                                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg)}>
                                          <Icon className="h-4 w-4 text-white" />
                                        </div>
                                      </TabsTrigger>
                                    );
                                  })}
                                </TabsList>

                                <div className="flex-1 overflow-y-auto">
                                  {selectedPlatforms.map((platform) => {
                                    const platformVariants = variants.filter(v => v.platform === platform);
                                    const format = platformVariants[0]?.format; // Only one format per platform

                                    return (
                                      <TabsContent key={platform} value={platform} className="mt-0 space-y-4">
                                        {format && (
                                          <div className="mb-2 flex gap-1">
                                            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                                              {FORMAT_LABELS[format]}
                                            </span>
                                          </div>
                                        )}
                                        <PreviewCard
                                          platform={platform}
                                          accounts={accounts}
                                          variants={variants}
                                          platformFormats={platformFormats}
                                          platformContent={platformContent}
                                          baseCaption={baseCaption}
                                          postTitle={postTitle}
                                          mainLink={mainLink}
                                          mediaUrls={mediaUrls}
                                          previewDevice={previewDevice}
                                          t={t}
                                        />
                                      </TabsContent>
                                    );
                                  })}
                                </div>
                              </Tabs>
                            )}

                        {/* Disclaimer */}
                        <div className="mt-4 rounded-lg border-t border-slate-200 bg-slate-50 p-3">
                          <p className="flex items-start gap-2 text-xs text-slate-500">
                            <span className="mt-0.5">ℹ️</span>
                            <span>{t('preview_disclaimer')}</span>
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>

                  </form>
                )}
      </div>
    </div>
  );
}
