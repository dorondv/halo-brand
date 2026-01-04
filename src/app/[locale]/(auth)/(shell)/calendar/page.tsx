'use client';

import {
  addWeeks,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getDay,
  isPast,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subWeeks,
} from 'date-fns';
import { enUS, he } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  Building2,
  Calendar1,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBrand } from '@/contexts/BrandContext';
import { cn } from '@/libs/cn';

// Force dynamic rendering - this page requires authentication

export const dynamic = 'force-dynamic';

// Important dates data - abbreviated for demo (you can add more)
const importantDates: Record<
  string,
  { type: string; name: string; category: string; description?: string }
> = {
  '2024-11-01': {
    type: 'banking',
    name: 'יום הבנק - נובמבר',
    category: 'בנקאי',
    description: 'יום ללא פעילות בנקאית. הזדמנות לתוכן על תכנון פיננסי לסוף השנה.',
  },
  '2024-11-11': {
    type: 'commercial',
    name: 'יום הרווקים הסיני - Singles Day',
    category: 'מסחרי',
    description: 'חג הקניות המקוונות הגדול בעולם. יום למבצעים אגרסיביים, קופונים והנחות משמעותיות.',
  },
  '2024-11-28': {
    type: 'national',
    name: 'חג ההודיה - ארה״ב',
    category: 'לאומי',
    description: 'חג ההודיה האמריקאי. תוכן על הכרת טובה, משפחה ומסורות אמריקאיות.',
  },
  '2024-11-29': {
    type: 'commercial',
    name: 'בלאק פריידי',
    category: 'מסחרי',
    description: 'יום הקניות הגדול בעולם. חובה להכין קמפיין מבצעים אגרסיבי מראש.',
  },
  '2024-12-25': {
    type: 'christian',
    name: 'חג המולד',
    category: 'נוצרי',
    description: 'חג לידת ישו. עונת מתנות, חגיגות ומבצעי חורף.',
  },
  '2024-12-26': {
    type: 'jewish',
    name: 'חנוכה',
    category: 'יהודי',
    description: 'חג האור. מתאים למבצעי מתנות, מתכני סופגניות ולביבות.',
  },
  '2024-12-31': {
    type: 'civil',
    name: 'ערב השנה החדשה',
    category: 'אזרחי',
    description: 'סיום השנה. מסיבות, תחזיות לשנה הבאה ותוכן של סיכום והתחלות חדשות.',
  },
  '2025-01-01': { type: 'civil', name: 'ראש השנה האזרחי', category: 'אזרחי' },
  '2025-02-14': { type: 'commercial', name: 'יום האהבה', category: 'מסחרי' },
  '2025-03-08': { type: 'international', name: 'יום האישה הבינלאומי', category: 'בינלאומי' },
  '2025-04-22': { type: 'international', name: 'יום כדור הארץ', category: 'בינלאומי' },
  '2025-05-09': { type: 'jewish', name: 'יום העצמאות', category: 'ישראלי' },
};

const getCategoryConfig = (type: string, t: (key: string) => string) => {
  const configs: Record<string, { color: string; name: string; bgColor: string }> = {
    jewish: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      name: t('category_jewish'),
      bgColor: 'bg-blue-500',
    },
    muslim: {
      color: 'bg-green-100 text-green-800 border-green-200',
      name: t('category_muslim'),
      bgColor: 'bg-green-500',
    },
    christian: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      name: t('category_christian'),
      bgColor: 'bg-yellow-500',
    },
    commercial: {
      color: 'bg-pink-100 text-pink-800 border-pink-200',
      name: t('category_commercial'),
      bgColor: 'bg-pink-500',
    },
    international: {
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      name: t('category_international'),
      bgColor: 'bg-purple-500',
    },
    sports: {
      color: 'bg-red-100 text-red-800 border-red-200',
      name: t('category_sports'),
      bgColor: 'bg-red-500',
    },
    civil: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      name: t('category_civil'),
      bgColor: 'bg-gray-500',
    },
    national: {
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      name: t('category_national'),
      bgColor: 'bg-indigo-500',
    },
    banking: {
      color: 'bg-amber-100 text-amber-800 border-amber-200',
      name: t('category_banking'),
      bgColor: 'bg-amber-500',
    },
  };
  return configs[type] || configs.civil;
};

// Platform Icon Component
const PlatformIcon = ({ platform, className }: { platform: string | null | undefined; className?: string }) => {
  // Handle cases where platform might be null, undefined, or not a string
  if (!platform || typeof platform !== 'string') {
    return <span className={className || 'h-4 w-4'}>📱</span>;
  }

  const platformLower = platform.toLowerCase();
  const iconClass = className || 'h-4 w-4';

  if (platformLower === 'instagram') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  if (platformLower === 'facebook') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  if (platformLower === 'x' || platformLower === 'twitter') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (platformLower === 'youtube') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (platformLower === 'linkedin') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }
  if (platformLower === 'tiktok') {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  return <span className={iconClass}>📱</span>;
};

type Post = {
  id: string;
  content: string;
  scheduled_time: string;
  platforms?: string[];
  brand_id?: string;
  brand_name?: string;
  brand_logo_url?: string | null;
};

export default function CalendarPage() {
  const t = useTranslations('Calendar');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const router = useRouter();
  const { selectedBrandId } = useBrand();
  // Initialize currentDate based on view mode - default to week view showing current week
  const [currentDate, setCurrentDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: isRTL ? 6 : 0 }));
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Get default time for scheduling - current time, or 5 minutes from now if current time is too close
  const getDefaultTime = (selectedDate: Date | null = null) => {
    const now = new Date();
    const minDateTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now

    // If a date is selected and it's today, ensure time is at least 5 minutes in the future
    if (selectedDate && isToday(selectedDate)) {
      const hours = String(minDateTime.getHours()).padStart(2, '0');
      const minutes = String(minDateTime.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    // Otherwise, use current time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const [selectedTime, setSelectedTime] = useState<string>(() => getDefaultTime());
  const [timeError, setTimeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showImportantDates, setShowImportantDates] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('week');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);

  const allCategoryTypes = [...new Set(Object.values(importantDates).map(date => date.type))];
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => allCategoryTypes);

  // Load scheduled posts from database
  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      setIsLoading(true);
      try {
        // Calculate date range for current month (and next week)
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const nextWeekEnd = new Date(monthEnd);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 7); // Include next week

        // Fetch scheduled posts from database
        // Add brandId parameter only if a specific brand is selected (not null/undefined)
        const brandParam = selectedBrandId ? `&brandId=${selectedBrandId}` : '';
        const url = `/api/scheduled-posts?start=${monthStart.toISOString()}&end=${nextWeekEnd.toISOString()}${brandParam}`;
        const response = await fetch(url, {
          cache: 'no-store', // Ensure fresh data on each request
        });

        if (!response.ok) {
          throw new Error('Failed to fetch scheduled posts');
        }

        const { data } = await response.json();

        // Transform database posts to calendar format
        const calendarPosts: Post[] = (data || []).map((item: any, index: number) => {
          // Ensure we always have a unique ID
          const itemId = item.post_id || item.id || item.post?.id;
          const contentHash = (item.post?.content || item.content || '').substring(0, 20).replace(/\s/g, '');
          const scheduledTime = item.scheduled_for || item.scheduled_time || '';
          const uniqueId = itemId || `post-${index}-${scheduledTime}-${contentHash || 'unknown'}`;

          // Normalize platforms array - handle both string and object formats
          const rawPlatforms = item.post?.platforms || item.platforms || [];
          const normalizedPlatforms = rawPlatforms.map((p: any) => {
            if (typeof p === 'string') {
              return p;
            }
            if (typeof p === 'object' && p !== null) {
              // Handle object format: {platform: 'instagram', account_id: '...'}
              return p.platform || p.name || String(p);
            }
            return String(p);
          }).filter((p: any) => p && typeof p === 'string');

          return {
            id: uniqueId,
            content: item.post?.content || item.content || '',
            scheduled_time: item.scheduled_for || item.scheduled_time,
            platforms: normalizedPlatforms,
            brand_id: item.post?.brand_id || item.brand_id,
            brand_name: item.post?.brands?.name || item.brand_name,
            brand_logo_url: item.post?.brands?.logo_url || item.brand_logo_url,
            is_getlate: item.is_getlate || false,
          };
        });

        if (isMounted) {
          setPosts(calendarPosts.filter(post => post.scheduled_time));
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setPosts([]);
          setIsLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [currentDate, selectedBrandId]);

  // Validate time when date or time changes
  const validateTime = useCallback((date: Date | null, time: string) => {
    if (!date || !time) {
      setTimeError(null);
      return true;
    }

    const selectedDateTime = new Date(`${format(date, 'yyyy-MM-dd')}T${time}`);
    const now = new Date();
    const minDateTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now

    if (isSameDay(date, now) && selectedDateTime < minDateTime) {
      setTimeError(t('time_in_past') || 'Selected time must be at least 5 minutes in the future');
      return false;
    }

    setTimeError(null);
    return true;
  }, [t]);

  useEffect(() => {
    if (selectedDate && selectedTime) {
      validateTime(selectedDate, selectedTime);
    } else {
      setTimeError(null);
    }
  }, [selectedDate, selectedTime, validateTime]);

  // Ensure week view shows current week on mount and when viewMode changes to week
  useEffect(() => {
    if (viewMode === 'week') {
      const now = new Date();
      const currentWeekStart = startOfWeek(now, { weekStartsOn: isRTL ? 6 : 0 });
      const displayedWeekStart = startOfWeek(currentDate, { weekStartsOn: isRTL ? 6 : 0 });
      // Only update if we're not already showing the current week
      // But only when viewMode changes, not when currentDate changes (to allow navigation)
      if (!isSameDay(currentWeekStart, displayedWeekStart)) {
        setCurrentDate(currentWeekStart);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isRTL]); // Removed currentDate from dependencies to allow navigation

  const toggleCategory = (categoryType: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryType)
        ? prev.filter(c => c !== categoryType)
        : [...prev, categoryType],
    );
  };

  const navigateTime = (direction: number) => {
    if (viewMode === 'week') {
      setCurrentDate(direction > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      const newDate = new Date(currentDate);
      if (viewMode === 'month') {
        newDate.setMonth(currentDate.getMonth() + direction);
      } else {
        newDate.setFullYear(currentDate.getFullYear() + direction);
      }
      setCurrentDate(newDate);
    }
  };

  const goToThisWeek = () => {
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: isRTL ? 6 : 0 }));
  };

  const getPostsForDate = (date: Date) => {
    const filtered = posts.filter(
      post => post.scheduled_time && isSameDay(new Date(post.scheduled_time), date),
    );
    // Ensure all posts have unique IDs
    return filtered.map((post, index) => ({
      ...post,
      id: post.id || `post-${date.toISOString()}-${index}-${post.content?.substring(0, 10) || 'unknown'}`,
    }));
  };

  const getImportantDateForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return importantDates[dateStr] || null;
  };

  const getImportantDatesForPeriod = (date: Date) => {
    if (viewMode === 'month') {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      return Object.entries(importantDates)
        .filter(([dateKey]) => dateKey.startsWith(`${year}-${month}`))
        .map(([dateKey, event]) => ({
          date: new Date(`${dateKey}T00:00:00`),
          ...event,
        }))
        .filter(event => selectedCategories.includes(event.type));
    } else {
      const year = date.getFullYear();

      return Object.entries(importantDates)
        .filter(([dateKey]) => dateKey.startsWith(`${year}`))
        .map(([dateKey, event]) => ({
          date: new Date(`${dateKey}T00:00:00`),
          ...event,
        }))
        .filter(event => selectedCategories.includes(event.type));
    }
  };

  const getYearCategorySummary = (year: number) => {
    const yearStr = year.toString();
    const yearEvents = Object.entries(importantDates)
      .filter(([dateKey]) => dateKey.startsWith(yearStr))
      .map(([, event]) => event)
      .filter(event => selectedCategories.includes(event.type));

    const categoryCounts: Record<string, number> = {};
    yearEvents.forEach((event) => {
      categoryCounts[event.type] = (categoryCounts[event.type] || 0) + 1;
    });

    return categoryCounts;
  };

  // Generate hourly time slots (e.g., 8:00am to 10:00pm)
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 22; hour++) {
      const time = new Date();
      time.setHours(hour, 0, 0, 0);
      slots.push(format(time, 'h:00 a'));
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Get current time indicator position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const hourIndex = currentHour - 8; // Starting from 8am
    if (hourIndex < 0 || hourIndex >= timeSlots.length) {
      return null;
    }
    const minuteOffset = (currentMinute / 60) * 60; // Height per hour slot
    return { hourIndex, minuteOffset };
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: isRTL ? 6 : 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: isRTL ? 6 : 0 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const dayNames = [
      t('day_sunday'),
      t('day_monday'),
      t('day_tuesday'),
      t('day_wednesday'),
      t('day_thursday'),
      t('day_friday'),
      t('day_saturday'),
    ];

    const currentTimePos = getCurrentTimePosition();

    return (
      <div className="flex h-[calc(100vh-300px)] min-h-[600px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Week Header */}
        <div className="sticky top-0 z-10 grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-200 bg-white">
          <div className="border-r border-slate-200 p-3"></div>
          {weekDays.map((day) => {
            const dayName = dayNames[getDay(day)];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const dayPosts = getPostsForDate(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'cursor-pointer border-r border-slate-200 p-3 text-center transition-colors last:border-r-0 hover:bg-slate-50',
                  isSelected ? 'bg-pink-50' : isTodayDate ? 'bg-pink-50' : '',
                )}
                onClick={() => {
                  setSelectedDate(day);
                  // Set time to default (current time or 5 min from now if today)
                  setSelectedTime(getDefaultTime(day));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDate(day);
                    setSelectedTime(getDefaultTime(day));
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="text-xs font-medium text-slate-500">{dayName}</div>
                <div
                  className={cn(
                    'mt-1 inline-block text-lg font-semibold',
                    isSelected
                      ? 'rounded-full bg-pink-600 px-3 py-1 text-white'
                      : isTodayDate
                        ? 'rounded-full bg-pink-600 px-3 py-1 text-white'
                        : 'text-slate-900',
                  )}
                >
                  {format(day, 'd')}
                </div>
                {dayPosts.length > 0 && (
                  <div className="mt-1 text-xs font-medium text-pink-600">{dayPosts.length}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div className="flex flex-1 overflow-auto">
          {/* Time Column */}
          <div className="sticky left-0 z-10 w-[80px] border-r border-slate-200 bg-slate-50">
            {timeSlots.map((time, idx) => {
              const isCurrentHour = currentTimePos && currentTimePos.hourIndex === idx;
              return (
                <div
                  key={time}
                  className="relative border-b border-slate-100 p-2"
                  style={{ minHeight: '60px' }}
                >
                  <div className="text-xs font-medium text-slate-600">{time}</div>
                  {isCurrentHour && (
                    <div
                      className="absolute right-0 left-0 z-20 flex items-center"
                      style={{ top: `${currentTimePos.minuteOffset}px` }}
                    >
                      <div className="h-0.5 w-full bg-pink-500"></div>
                      <div className="absolute -left-2 h-2 w-2 rounded-full bg-pink-500"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Days Grid */}
          <div className="grid flex-1 grid-cols-7">
            {weekDays.map((day) => {
              const dayPosts = getPostsForDate(day);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className="border-r border-slate-200 last:border-r-0"
                >
                  {timeSlots.map((time, timeIdx) => {
                    const slotHour = 8 + timeIdx;
                    // Normalize day to midnight to ensure correct date formatting
                    const normalizedDay = new Date(day);
                    normalizedDay.setHours(0, 0, 0, 0);
                    const slotDate = new Date(normalizedDay);
                    slotDate.setHours(slotHour, 0, 0, 0);

                    // Find posts for this time slot
                    const slotPosts = dayPosts.filter((post) => {
                      const postDate = new Date(post.scheduled_time);
                      return postDate.getHours() === slotHour;
                    });

                    const isEmptySlot = slotPosts.length === 0;
                    // Format time as HH:mm (24-hour format)
                    const timeString = `${String(slotHour).padStart(2, '0')}:00`;

                    // Check if this time slot is in the past
                    const now = new Date();
                    const isPastSlot = isPast(slotDate) || (isTodayDate && slotDate < now);

                    return (
                      <div
                        key={`${day.toISOString()}-${time}`}
                        className={cn(
                          'group relative min-h-[60px] border-b border-slate-100 p-1 transition-colors',
                          isPastSlot
                            ? 'cursor-not-allowed bg-slate-50 opacity-50'
                            : isEmptySlot
                              ? 'cursor-pointer hover:bg-pink-50'
                              : 'hover:bg-slate-50',
                        )}
                        onClick={() => {
                          // Don't allow clicking on past slots
                          if (isPastSlot) {
                            return;
                          }

                          if (isEmptySlot) {
                            // Empty slot - redirect to create post with date/time
                            // Ensure date is normalized to midnight in local timezone
                            const dateForFormat = new Date(normalizedDay);
                            dateForFormat.setHours(0, 0, 0, 0);
                            // Format date as yyyy-MM-dd (date-fns format handles local timezone correctly)
                            const dateStr = format(dateForFormat, 'yyyy-MM-dd');
                            // Time is already in HH:mm format (e.g., "14:00")
                            router.push(`/create-post?date=${dateStr}&time=${timeString}&schedule=later`);
                          } else {
                            // Has posts - select date and time
                            setSelectedDate(normalizedDay);
                            setSelectedTime(timeString);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isPastSlot) {
                              return;
                            }
                            if (isEmptySlot) {
                              const dateForFormat = new Date(normalizedDay);
                              dateForFormat.setHours(0, 0, 0, 0);
                              const dateStr = format(dateForFormat, 'yyyy-MM-dd');
                              router.push(`/create-post?date=${dateStr}&time=${timeString}&schedule=later`);
                            } else {
                              setSelectedDate(normalizedDay);
                              setSelectedTime(timeString);
                            }
                          }
                        }}
                        role={isPastSlot ? undefined : 'button'}
                        tabIndex={isPastSlot ? -1 : 0}
                      >
                        {isEmptySlot && !isPastSlot && (
                          <div className="flex h-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                            <Plus className="h-5 w-5 text-pink-400" />
                          </div>
                        )}
                        {isPastSlot && isEmptySlot && (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-xs text-slate-400">Past</span>
                          </div>
                        )}
                        {slotPosts.map(post => (
                          <div
                            key={post.id || `post-${post.scheduled_time}-${post.content?.substring(0, 10) || 'unknown'}`}
                            className="mb-1 cursor-pointer rounded bg-gradient-to-r from-pink-500 to-pink-600 p-1.5 text-xs text-white shadow-sm transition-all hover:shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Always allow viewing post details, even if in the past
                              setSelectedPost(post);
                              setShowPostDialog(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedPost(post);
                                setShowPostDialog(true);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="truncate font-medium">{post.content.substring(0, 30)}</div>
                            <div className="mt-1 flex items-center gap-1">
                              {post.platforms?.slice(0, 3).map(platform => (
                                <PlatformIcon
                                  key={`${post.id || 'post'}-platform-${String(platform)}`}
                                  platform={String(platform)}
                                  className="h-3 w-3"
                                />
                              ))}
                              {post.platforms && post.platforms.length > 3 && (
                                <span className="text-[10px]">
                                  +
                                  {post.platforms.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startingDayIndex = getDay(monthStart);

    const dayNames = [
      t('day_sunday'),
      t('day_monday'),
      t('day_tuesday'),
      t('day_wednesday'),
      t('day_thursday'),
      t('day_friday'),
      t('day_saturday'),
    ];

    return (
      <>
        <div className="mb-4 grid grid-cols-7 gap-4">
          {dayNames.map(day => (
            <div key={day} className="py-2 text-center font-medium text-slate-500">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: startingDayIndex }, (_, index) => (
            <div key={`padding-${startingDayIndex}-${index}`} aria-hidden="true" />
          ))}
          {daysInMonth.map((date) => {
            const dayPosts = getPostsForDate(date);
            const importantDate = getImportantDateForDay(date);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);
            const hasImportantDate
              = importantDate && showImportantDates && selectedCategories.includes(importantDate.type);
            const config = importantDate ? getCategoryConfig(importantDate.type, t as any) : null;

            return (
              <motion.div
                key={date.toISOString()}
                whileHover={{ scale: 1.05 }}
                className={`aspect-square cursor-pointer rounded-xl border-2 p-2 transition-all duration-300 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : isTodayDate
                      ? 'border-emerald-300 bg-emerald-50'
                      : hasImportantDate
                        ? `${config?.color.split(' ')[0]} border-${config?.bgColor.split('-')[1]}-300`
                        : dayPosts.length > 0
                          ? 'border-orange-200 bg-orange-50 hover:border-orange-300'
                          : 'border-white/30 hover:border-slate-200 hover:bg-white/50'
                }`}
                onClick={() => {
                  setSelectedDate(date);
                  // Set time to default (current time or 5 min from now if today)
                  setSelectedTime(getDefaultTime(date));
                }}
              >
                <div className="flex h-full flex-col">
                  <div
                    className={`mb-1 text-sm font-medium ${
                      isTodayDate
                        ? 'text-emerald-600'
                        : isSelected
                          ? 'text-blue-600'
                          : hasImportantDate
                            ? `text-${config?.bgColor.split('-')[1]}-700`
                            : isSameMonth(date, currentDate)
                              ? 'text-slate-900'
                              : 'text-slate-400'
                    }`}
                  >
                    {format(date, 'd')}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {hasImportantDate && (
                      <div
                        className={`rounded px-1 py-0.5 text-[11px] font-medium ${config?.color} line-clamp-2 text-center leading-tight`}
                        title={importantDate.name}
                      >
                        {importantDate.name}
                      </div>
                    )}

                    {dayPosts.slice(0, hasImportantDate ? 1 : 2).map((post, idx) => (
                      <div
                        key={post.id || `day-post-${date.toISOString()}-${idx}`}
                        className="truncate rounded bg-blue-500 px-2 py-1 text-xs text-white"
                        title={post.content}
                      >
                        {post.content.substring(0, 15)}
                        ...
                      </div>
                    ))}
                    {dayPosts.length > (hasImportantDate ? 1 : 2) && (
                      <div className="text-center text-xs text-slate-500">
                        +
                        {' '}
                        {dayPosts.length - (hasImportantDate ? 1 : 2)}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </>
    );
  };

  const renderYearView = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const monthsInYear = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return (
      <div className="grid grid-cols-3 gap-6 md:grid-cols-4">
        {monthsInYear.map((month) => {
          const allMonthEvents = getImportantDatesForPeriod(month);
          const monthEvents = allMonthEvents.filter(
            event => event.date.getMonth() === month.getMonth(),
          );

          return (
            <motion.div
              key={month.toISOString()}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="cursor-pointer rounded-xl border border-white/20 bg-white/70 p-4 backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
              onClick={() => {
                setCurrentDate(month);
                setViewMode('month');
              }}
            >
              <h3 className="mb-3 text-center font-bold text-slate-900">
                {format(month, 'MMMM')}
              </h3>
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {monthEvents.slice(0, 5).map((event) => {
                  const config = getCategoryConfig(event.type, t as any);
                  return (
                    <div key={`${event.date.toISOString()}-${event.name}`} className={`rounded px-2 py-1 text-xs ${config?.color || ''}`}>
                      {format(event.date, 'd/M')}
                      {' '}
                      -
                      {event.name}
                    </div>
                  );
                })}
                {monthEvents.length > 5 && (
                  <div className="text-center text-xs text-slate-500">
                    +
                    {' '}
                    {monthEvents.length - 5}
                  </div>
                )}
                {monthEvents.length === 0 && (
                  <div className="py-2 text-center text-xs text-slate-400">{t('no_events')}</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : [];
  const selectedImportantEvent = selectedDate ? getImportantDateForDay(selectedDate) : null;
  const selectedDateImportant
    = selectedImportantEvent && selectedCategories.includes(selectedImportantEvent.type)
      ? selectedImportantEvent
      : null;
  const periodImportantDates = getImportantDatesForPeriod(currentDate);

  // Calculate min time for time picker (if selecting today, must be at least 5 minutes from now)
  const getMinTime = () => {
    if (!selectedDate) {
      return '00:00';
    }
    const now = new Date();
    if (isSameDay(selectedDate, now)) {
      const minTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
      return format(minTime, 'HH:mm');
    }
    return '00:00';
  };

  const minTime = getMinTime();

  const yearCategorySummary
    = viewMode === 'year' ? getYearCategorySummary(currentDate.getFullYear()) : {};
  const totalYearEvents = Object.values(yearCategorySummary).reduce(
    (sum, count) => sum + count,
    0,
  );

  const legendItems = [
    { type: 'jewish' },
    { type: 'muslim' },
    { type: 'christian' },
    { type: 'commercial' },
    { type: 'international' },
    { type: 'national' },
    { type: 'banking' },
    { type: 'sports' },
    { type: 'civil' },
  ];

  return (
    <div className="min-h-screen p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('flex flex-col gap-6 md:flex-row md:items-center', isRTL ? 'items-start justify-between' : 'items-start justify-between')}
        >
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
              {t('title')}
            </h1>
            <p className="mt-2 text-lg text-slate-500">{t('subtitle')}</p>
          </div>

          <div className={cn('flex flex-wrap gap-4', isRTL ? 'flex-row-reverse' : '')}>
            <div className="flex overflow-hidden rounded-lg border border-pink-200 bg-white/50">
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                onClick={() => {
                  setViewMode('week');
                  // Reset to current week when switching to week view
                  setCurrentDate(startOfWeek(new Date(), { weekStartsOn: isRTL ? 6 : 0 }));
                }}
                className={`rounded-none ${
                  viewMode === 'week'
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'hover:bg-pink-50'
                }`}
              >
                <CalendarIcon className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                {t('week_view') || 'Week'}
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                onClick={() => {
                  setViewMode('month');
                  // Reset to current month when switching to month view
                  setCurrentDate(startOfMonth(new Date()));
                }}
                className={`rounded-none ${
                  viewMode === 'month'
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'hover:bg-pink-50'
                }`}
              >
                <Calendar1 className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                {t('month_view')}
              </Button>
              <Button
                variant={viewMode === 'year' ? 'default' : 'ghost'}
                onClick={() => {
                  setViewMode('year');
                  // Reset to current year when switching to year view
                  setCurrentDate(startOfYear(new Date()));
                }}
                className={`rounded-none ${
                  viewMode === 'year'
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'hover:bg-pink-50'
                }`}
              >
                <Grid3x3 className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                {t('year_view')}
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowImportantDates(!showImportantDates)}
              className="border-pink-200 bg-white/70 text-pink-700 hover:bg-pink-50"
            >
              <Sparkles className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              {showImportantDates ? t('hide_events') : t('show_events')}
            </Button>
          </div>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-6 w-6 text-pink-500" />
                    {viewMode === 'week'
                      ? `${format(startOfWeek(currentDate, { weekStartsOn: isRTL ? 6 : 0 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: isRTL ? 6 : 0 }), 'MMM d, yyyy')}`
                      : viewMode === 'month'
                        ? format(currentDate, 'MMMM yyyy')
                        : format(currentDate, 'yyyy')}
                  </CardTitle>
                  <div className={cn('flex gap-2', isRTL ? 'flex-row-reverse' : '')}>
                    {viewMode === 'week' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToThisWeek}
                        className="hover:bg-blue-50"
                      >
                        {t('this_week') || 'This Week'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateTime(isRTL ? 1 : -1)}
                      className="hover:bg-blue-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateTime(isRTL ? -1 : 1)}
                      className="hover:bg-blue-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={viewMode === 'week' ? 'p-0' : 'p-6'}>
                {isLoading
                  ? (
                      <div className="py-8 text-center text-slate-500">{t('loading')}</div>
                    )
                  : viewMode === 'week'
                    ? (
                        renderWeekView()
                      )
                    : viewMode === 'month'
                      ? (
                          renderMonthView()
                        )
                      : (
                          renderYearView()
                        )}
              </CardContent>
            </Card>

            <Card className="mt-6 border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
              <CardHeader>
                <div className={cn('flex items-center', isRTL ? 'justify-between flex-row-reverse' : 'justify-between')}>
                  <CardTitle>{t('legend_title')}</CardTitle>
                  {viewMode === 'year' && (
                    <div className="text-sm text-slate-600">
                      {t('total_events_year', { count: totalYearEvents, year: currentDate.getFullYear() })}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {legendItems.map((item) => {
                    const config = getCategoryConfig(item.type, t as any);
                    const isSelected = selectedCategories.includes(item.type);
                    const eventCount
                      = viewMode === 'year' ? (yearCategorySummary[item.type] || 0) : null;

                    if (!config) {
                      return null;
                    }

                    return (
                      <div
                        key={item.type}
                        className={cn('flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-all duration-300', isRTL ? 'flex-row-reverse' : '', isSelected ? 'bg-white/70 shadow-sm' : 'opacity-50 hover:opacity-100')}
                        onClick={() => toggleCategory(item.type)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleCategory(item.type);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={`h-4 w-4 rounded ${config.bgColor}`}></div>
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-600">{config.name}</span>
                          {viewMode === 'year' && eventCount !== null && eventCount > 0 && (
                            <span className="text-xs text-slate-400">
                              {eventCount}
                              {' '}
                              {t('events')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {viewMode === 'month' && (
              <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>
                    {selectedDate
                      ? format(selectedDate, 'MMMM d, yyyy')
                      : t('select_date')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedDate
                      ? (
                          <>
                            {selectedDateImportant && (() => {
                              const categoryConfig = getCategoryConfig(selectedDateImportant.type, t as any);
                              if (!categoryConfig) {
                                return null;
                              }
                              return (
                                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                                  <div className={cn('mb-2 flex items-center', isRTL ? 'justify-between flex-row-reverse' : 'justify-between')}>
                                    <Badge className={categoryConfig.color}>
                                      {categoryConfig.name}
                                    </Badge>
                                  </div>
                                  <h4 className="font-semibold text-purple-900">
                                    {selectedDateImportant.name}
                                  </h4>
                                  {selectedDateImportant.description && (
                                    <p className="mt-2 text-sm text-purple-700">
                                      {selectedDateImportant.description}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                            {selectedDatePosts.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="font-semibold text-slate-900">{t('your_posts')}</h4>
                                {selectedDatePosts.map((post, idx) => (
                                  <div
                                    key={post.id || `selected-post-${selectedDate?.toISOString()}-${idx}`}
                                    className="rounded-xl border border-white/30 p-4"
                                  >
                                    <p className="mb-2 line-clamp-2 font-medium text-slate-900">
                                      {post.content}
                                    </p>
                                    <div className={cn('flex items-center gap-2', isRTL ? 'justify-between flex-row-reverse' : 'justify-between')}>
                                      <Badge variant="secondary" className="text-xs">
                                        {format(new Date(post.scheduled_time), 'h:mm a')}
                                      </Badge>
                                      <div className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                                        {/* Brand Info */}
                                        {post.brand_name && (
                                          <div className={cn('flex items-center gap-1.5', isRTL ? 'flex-row-reverse' : '')}>
                                            {post.brand_logo_url
                                              ? (
                                                  <Image
                                                    src={post.brand_logo_url}
                                                    alt={post.brand_name}
                                                    width={16}
                                                    height={16}
                                                    className="h-4 w-4 rounded-full object-cover"
                                                  />
                                                )
                                              : (
                                                  <Building2 className="h-4 w-4 text-slate-500" />
                                                )}
                                            <span className="text-xs text-slate-600">{post.brand_name}</span>
                                          </div>
                                        )}
                                        {/* Platform Icons */}
                                        {post.platforms && post.platforms.length > 0 && (
                                          <div className={cn('flex items-center gap-1', isRTL ? 'flex-row-reverse' : '')}>
                                            {post.platforms
                                              .filter(platform => platform && typeof platform === 'string')
                                              .map(platform => (
                                                <div
                                                  key={`${post.id}-platform-${String(platform)}`}
                                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                                                  title={String(platform)}
                                                >
                                                  <PlatformIcon platform={String(platform)} className="h-3 w-3" />
                                                </div>
                                              ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )
                      : (
                          <div className="py-4 text-center text-slate-500">
                            <CalendarIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                            <p className="text-sm">{t('click_date_events')}</p>
                          </div>
                        )}

                    {/* Time Picker Section - Always Visible */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className={cn('mb-3 flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                        <Clock className="h-4 w-4 text-pink-500" />
                        <Label htmlFor="schedule-time" className="text-sm font-semibold text-slate-700">
                          {t('select_time')}
                        </Label>
                      </div>
                      <div className="mb-3">
                        <Input
                          id="schedule-time"
                          type="time"
                          value={selectedTime}
                          min={minTime}
                          onChange={(e) => {
                            const time = e.target.value;
                            if (time) {
                              setSelectedTime(time);
                              validateTime(selectedDate, time);
                            }
                          }}
                          className={cn(
                            'w-full border-slate-300 bg-white focus:border-pink-400 focus:ring-pink-400',
                            timeError ? 'border-red-300 focus:border-red-400 focus:ring-red-400' : '',
                          )}
                        />
                      </div>
                      <Link
                        href={
                          selectedDate && !timeError
                            ? `/create-post?date=${format(selectedDate, 'yyyy-MM-dd')}&time=${selectedTime}&schedule=later`
                            : '/create-post'
                        }
                        className="block w-full"
                      >
                        <Button
                          size="default"
                          disabled={!selectedDate || !!timeError}
                          className="w-full bg-gradient-to-r from-pink-500 to-pink-600 py-2 text-white shadow-md hover:from-pink-600 hover:to-pink-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                          {t('schedule_post')}
                        </Button>
                      </Link>
                      {timeError
                        ? (
                            <p className="mt-2 text-xs text-red-600">{timeError}</p>
                          )
                        : (
                            <p className="mt-2 text-xs text-slate-500">
                              {selectedDate && selectedTime
                                ? format(
                                    new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}`),
                                    'PPp',
                                    { locale: locale === 'he' ? he : enUS },
                                  )
                                : t('select_time_hint')}
                            </p>
                          )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === 'month' && (
              <Card className="border-white/20 bg-white/70 shadow-xl backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className={cn('flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                    <Sparkles className="h-5 w-5 text-pink-500" />
                    {t('important_events_month')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {periodImportantDates.length > 0
                    ? (
                        <div className="max-h-96 space-y-3 overflow-y-auto">
                          {periodImportantDates
                            .sort((a, b) => a.date.getTime() - b.date.getTime())
                            .map((event) => {
                              const config = getCategoryConfig(event.type, t as any);
                              if (!config) {
                                return null;
                              }
                              return (
                                <div
                                  key={`${event.date.toISOString()}-${event.name}`}
                                  className={`rounded-lg border p-3 ${config.color} cursor-pointer transition-all duration-200 hover:shadow-md`}
                                  onClick={() => {
                                    setSelectedDate(event.date);
                                    // Set time to default (current time or 5 min from now if today)
                                    setSelectedTime(getDefaultTime(event.date));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedDate(event.date);
                                      // Set time to default (current time or 5 min from now if today)
                                      setSelectedTime(getDefaultTime(event.date));
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className={cn('flex items-start gap-2', isRTL ? 'justify-between flex-row-reverse' : 'justify-between')}>
                                    <div className="flex-1">
                                      <div className={cn('mb-1 flex items-center gap-2', isRTL ? 'flex-row-reverse' : '')}>
                                        <Badge className={config.color} variant="secondary">
                                          {format(event.date, 'd')}
                                          /
                                          {format(event.date, 'M')}
                                        </Badge>
                                      </div>
                                      <h4 className="mb-1 text-sm font-semibold">{event.name}</h4>
                                      {event.description && (
                                        <p className="mt-1 line-clamp-2 text-xs opacity-80">
                                          {event.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )
                    : (
                        <div className="py-6 text-center text-sm text-slate-400">
                          {t('no_events_month')}
                        </div>
                      )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Post Details Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col p-0">
          <DialogClose />
          <DialogHeader className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-pink-500" />
              {t('post_details') || 'Post Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto px-6 py-4">
              {/* Post Content */}
              <div className="flex-shrink-0">
                <Label className="text-sm font-semibold text-slate-700">
                  {t('content') || 'Content'}
                </Label>
                <div className="mt-1 max-h-[40vh] min-h-[60px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm break-words whitespace-pre-wrap text-slate-900">
                    {selectedPost.content}
                  </p>
                </div>
              </div>

              {/* Scheduled Time */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">
                  {t('scheduled_time') || 'Scheduled Time'}
                </Label>
                <p className="mt-1 text-sm text-slate-600">
                  {format(
                    new Date(selectedPost.scheduled_time),
                    'PPp',
                    { locale: locale === 'he' ? he : enUS },
                  )}
                </p>
              </div>

              {/* Platforms */}
              {selectedPost.platforms && selectedPost.platforms.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    {t('platforms') || 'Platforms'}
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedPost.platforms.map(platform => (
                      <Badge key={String(platform)} variant="secondary" className="flex items-center gap-1.5">
                        <PlatformIcon platform={String(platform)} className="h-4 w-4" />
                        <span className="capitalize">{String(platform)}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Info */}
              {selectedPost.brand_name && (
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    {t('brand') || 'Brand'}
                  </Label>
                  <div className="mt-2 flex items-center gap-2">
                    {selectedPost.brand_logo_url
                      ? (
                          <Image
                            src={selectedPost.brand_logo_url}
                            alt={selectedPost.brand_name}
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        )
                      : (
                          <Building2 className="h-6 w-6 text-slate-500" />
                        )}
                    <span className="text-sm text-slate-900">{selectedPost.brand_name}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-shrink-0 gap-2 border-t border-slate-200 bg-white px-6 py-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPostDialog(false)}
                  className="w-full"
                >
                  {t('close') || 'Close'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
