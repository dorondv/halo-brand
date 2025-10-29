'use client';

import type { PostItem } from '@/libs/base44';
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns';
import {
  Calendar1,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Post } from '@/libs/base44';

type CategoryKey
  = | 'jewish'
    | 'muslim'
    | 'christian'
    | 'commercial'
    | 'international'
    | 'sports'
    | 'civil'
    | 'national'
    | 'banking';

const categoryConfig: Record<
  CategoryKey,
  { color: string; name: string; bgColor: string; borderColor: string; textColor: string }
> = {
  jewish: {
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    name: 'יהדות וישראל',
    bgColor: 'bg-blue-500',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
  },
  muslim: {
    color: 'bg-green-100 text-green-800 border-green-200',
    name: 'איסלאם',
    bgColor: 'bg-green-500',
    borderColor: 'border-green-300',
    textColor: 'text-green-700',
  },
  christian: {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    name: 'נצרות',
    bgColor: 'bg-yellow-500',
    borderColor: 'border-yellow-300',
    textColor: 'text-yellow-700',
  },
  commercial: {
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    name: 'מסחרי',
    bgColor: 'bg-pink-500',
    borderColor: 'border-pink-300',
    textColor: 'text-pink-700',
  },
  international: {
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    name: 'בינלאומי',
    bgColor: 'bg-purple-500',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
  },
  sports: {
    color: 'bg-red-100 text-red-800 border-red-200',
    name: 'ספורט',
    bgColor: 'bg-red-500',
    borderColor: 'border-red-300',
    textColor: 'text-red-700',
  },
  civil: {
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    name: 'אזרחי',
    bgColor: 'bg-gray-500',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-700',
  },
  national: {
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    name: 'לאומי',
    bgColor: 'bg-indigo-500',
    borderColor: 'border-indigo-300',
    textColor: 'text-indigo-700',
  },
  banking: {
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    name: 'בנקאות',
    bgColor: 'bg-amber-500',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
  },
};

const importantDates: Record<
  string,
  { type: CategoryKey; name: string; category: string; description?: string }
> = {
  '2024-01-01': { type: 'civil', name: 'ראש השנה האזרחי', category: 'אזרחי' },
  '2024-02-14': { type: 'commercial', name: 'יום האהבה - ולנטיינס', category: 'מסחרי' },
  '2024-03-08': { type: 'international', name: 'יום האישה הבינלאומי', category: 'בינלאומי' },
  '2024-04-22': { type: 'international', name: 'יום כדור הארץ', category: 'בינלאומי' },
  '2024-04-23': { type: 'jewish', name: 'פסח', category: 'יהודי' },
  '2024-05-12': { type: 'commercial', name: 'יום האם', category: 'מסחרי' },
  '2024-06-16': { type: 'commercial', name: 'יום האב', category: 'מסחרי' },
  '2024-09-16': { type: 'jewish', name: 'ראש השנה', category: 'יהודי' },
  '2024-10-31': { type: 'civil', name: 'ליל כל הקדושים - האלווין', category: 'אזרחי' },
  '2024-12-25': { type: 'christian', name: 'חג המולד', category: 'נוצרי' },
};

export default function CalendarClient(): React.ReactElement {
  const t = useTranslations('CalendarPage');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date('2024-11-01'));
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showImportantDates, setShowImportantDates] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  const allCategoryTypes = [
    ...new Set(Object.values(importantDates).map(date => date.type)),
  ] as CategoryKey[];
  const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>(
    allCategoryTypes,
  );

  useEffect(() => {
    void (async () => {
      const postsData = await Post.list();
      setPosts(postsData.filter(p => p.scheduled_time));
    })();
  }, [currentDate]);

  const toggleCategory = (categoryType: CategoryKey) => {
    setSelectedCategories(prev =>
      prev.includes(categoryType)
        ? prev.filter(c => c !== categoryType)
        : [...prev, categoryType],
    );
  };

  const navigateTime = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(currentDate.getMonth() + direction);
    } else {
      newDate.setFullYear(currentDate.getFullYear() + direction);
    }
    setCurrentDate(newDate);
  };

  const getPostsForDate = (date: Date) =>
    posts.filter(post => post.scheduled_time && isSameDay(new Date(post.scheduled_time), date));

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
        .map(([dateKey, event]) => ({ date: new Date(`${dateKey}T00:00:00`), ...event }))
        .filter(event => selectedCategories.includes(event.type));
    }
    const year = date.getFullYear();
    return Object.entries(importantDates)
      .filter(([dateKey]) => dateKey.startsWith(`${year}`))
      .map(([dateKey, event]) => ({ date: new Date(`${dateKey}T00:00:00`), ...event }))
      .filter(event => selectedCategories.includes(event.type));
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startingDayIndex = getDay(monthStart);

    const dayNames = [
      t('dayNames.sunday'),
      t('dayNames.monday'),
      t('dayNames.tuesday'),
      t('dayNames.wednesday'),
      t('dayNames.thursday'),
      t('dayNames.friday'),
      t('dayNames.saturday'),
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
          {Array.from({ length: startingDayIndex }, (_, index) =>
            subDays(monthStart, startingDayIndex - index)).map(paddingDate => (
            <div key={paddingDate.toISOString()} />
          ))}
          {daysInMonth.map((date) => {
            const dayPosts = getPostsForDate(date);
            const importantDate = getImportantDateForDay(date);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);
            const hasImportantDate
              = importantDate && showImportantDates && selectedCategories.includes(importantDate.type);
            const config = importantDate ? categoryConfig[importantDate.type] : null;

            return (
              <div
                key={date.toISOString()}
                // Removed whileHover from motion.div
                className={`aspect-square cursor-pointer rounded-xl border-2 p-2 transition-all duration-300 ${isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : isTodayDate
                    ? 'border-emerald-300 bg-emerald-50'
                    : hasImportantDate && config
                      ? `${config.borderColor} ${config.color.split(' ')[0]}`
                      : dayPosts.length > 0
                        ? 'border-orange-200 bg-orange-50 hover:border-orange-300'
                        : 'border-white/30 hover:border-slate-200 hover:bg-white/50'
                }`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDate(date)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedDate(date);
                  }
                }}
              >
                <div className="flex h-full flex-col">
                  <div
                    className={`mb-1 text-sm font-medium ${isTodayDate
                      ? 'text-emerald-600'
                      : isSelected
                        ? 'text-blue-600'
                        : hasImportantDate && config
                          ? config.textColor
                          : isSameMonth(date, currentDate)
                            ? 'text-slate-900'
                            : 'text-slate-400'
                    }`}
                  >
                    {format(date, 'd')}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {hasImportantDate && config && (
                      <div
                        className={`rounded px-1 py-0.5 text-[11px] font-medium ${config.color} line-clamp-2 text-center leading-tight`}
                        title={importantDate.name}
                      >
                        {importantDate.name}
                      </div>
                    )}

                    {dayPosts.slice(0, hasImportantDate ? 1 : 2).map(post => (
                      <div
                        key={post.id}
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
              </div>
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
            <div
              key={month.toISOString()}
              // Removed framer-motion props
              className="cursor-pointer rounded-xl border border-white/20 bg-white/70 p-4 backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
              role="button"
              tabIndex={0}
              onClick={() => {
                setCurrentDate(month);
                setViewMode('month');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setCurrentDate(month);
                  setViewMode('month');
                }
              }}
            >
              <h3 className="mb-3 text-center font-bold text-slate-900">{format(month, 'MMMM')}</h3>
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {monthEvents.slice(0, 5).map((event) => { // Removed index here
                  const config = categoryConfig[event.type];
                  return (
                    <div key={event.date.toISOString()} className={`rounded px-2 py-1 text-xs ${config.color}`}>
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
                    {monthEvents.length - 5}
                  </div>
                )}
                {monthEvents.length === 0 && (
                  <div className="py-2 text-center text-xs text-slate-400">{t('noSpecialEvents')}</div>
                )}
              </div>
            </div>
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

  const legendItems: { type: CategoryKey }[] = [
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
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div
          // Removed framer-motion props
          className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"
        >
          <div>
            <h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold text-transparent">
              {t('title')}
            </h1>
            <p className="mt-2 text-lg text-slate-500">{t('description')}</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex overflow-hidden rounded-lg border border-pink-200 bg-white/50">
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                onClick={() => setViewMode('month')}
                className={`rounded-none ${viewMode === 'month' ? 'bg-pink-500 text-white hover:bg-pink-600' : 'hover:bg-pink-50'}`}
              >
                <Calendar1 className="mr-2 h-4 w-4" />
                {t('monthView')}
              </Button>
              <Button
                variant={viewMode === 'year' ? 'default' : 'ghost'}
                onClick={() => setViewMode('year')}
                className={`rounded-none ${viewMode === 'year' ? 'bg-pink-500 text-white hover:bg-pink-600' : 'hover:bg-pink-50'}`}
              >
                <Grid3X3 className="mr-2 h-4 w-4" />
                {t('yearView')}
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowImportantDates(!showImportantDates)}
              className="border-pink-200 bg-white/70 text-pink-700 hover:bg-pink-50"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {showImportantDates ? t('hideEvents') : t('showEvents')}
            </Button>

            <Link href="/create-post">
              <Button className="rounded-xl bg-linear-to-r from-pink-500 to-pink-600 px-8 py-3 text-white shadow-lg transition-all duration-300 hover:from-pink-600 hover:to-pink-700 hover:shadow-xl">
                <Plus className="mr-2 h-5 w-5" />
                {t('schedulePost')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card className="border-white/20 shadow-xl backdrop-blur-lg">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-6 w-6 text-blue-500" />
                    {viewMode === 'month' ? format(currentDate, 'MMMM yyyy') : format(currentDate, 'yyyy')}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => navigateTime(-1)} className="hover:bg-blue-50">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => navigateTime(1)} className="hover:bg-blue-50">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">{viewMode === 'month' ? renderMonthView() : renderYearView()}</CardContent>
            </Card>

            <Card className="mt-6 border-white/20 shadow-xl backdrop-blur-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('legendTitle')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {legendItems.map((item) => {
                    const config = categoryConfig[item.type];
                    const isSelected = selectedCategories.includes(item.type);
                    return (
                      <div
                        key={item.type}
                        role="button"
                        tabIndex={0}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-all duration-300 ${
                          isSelected
                            ? 'bg-white/70 shadow-sm'
                            : 'opacity-50 hover:opacity-100'
                        }`}
                        onClick={() => toggleCategory(item.type)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            toggleCategory(item.type);
                          }
                        }}
                      >
                        <div
                          className={`h-4 w-4 rounded ${config.bgColor}`}
                        >
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-600">{config.name}</span>
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
              <Card className="border-white/20 shadow-xl backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>
                    {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : t('selectDate')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDate
                    ? (
                        <div className="space-y-4">
                          {selectedDateImportant && (
                            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <Badge className={categoryConfig[selectedDateImportant.type].color}>
                                  {categoryConfig[selectedDateImportant.type].name}
                                </Badge>
                              </div>
                              <h4 className="font-semibold text-purple-900">{selectedDateImportant.name}</h4>
                              {selectedDateImportant.description && (
                                <p className="mt-2 text-sm text-purple-700">{selectedDateImportant.description}</p>
                              )}
                            </div>
                          )}

                          {selectedDatePosts.length > 0
                            ? (
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-slate-900">{t('yourPosts')}</h4>
                                  {selectedDatePosts.map(post => (
                                    <div key={post.id} className="rounded-xl border border-white/30 p-4">
                                      <p className="mb-2 line-clamp-2 font-medium text-slate-900">{post.content}</p>
                                      <div className="flex items-center justify-between">
                                        <Badge variant="secondary" className="text-xs">
                                          {format(new Date(post.scheduled_time as string), 'h:mm a')}
                                        </Badge>
                                        <div className="text-xs text-slate-500">
                                          {post.platforms?.length}
                                          {' '}
                                          {t('platforms')}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            : (
                                !selectedDateImportant && (
                                  <div className="py-8 text-center text-slate-500">
                                    <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                    <p>{t('noScheduledPosts')}</p>
                                    <Link href="/create-post">
                                      <Button className="mt-4 bg-linear-to-r from-blue-500 to-emerald-500 text-white">
                                        {t('schedulePostButton')}
                                      </Button>
                                    </Link>
                                  </div>
                                )
                              )}
                        </div>
                      )
                    : (
                        <div className="py-8 text-center text-slate-500">
                          <p>{t('clickToSeeEvents')}</p>
                        </div>
                      )}
                </CardContent>
              </Card>
            )}

            <Card className="border-white/20 shadow-xl backdrop-blur-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  {' '}
                  {t('importantEvents')}
                  {viewMode === 'month' ? t('thisMonth') : t('thisYear')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {periodImportantDates.length > 0
                    ? (
                        periodImportantDates.map(event => (
                          <div key={event.date.toISOString()} className="rounded-lg border border-white/30 p-3 transition-colors hover:bg-white/50">
                            <div className="mb-1 flex items-center justify-between">
                              <Badge className={categoryConfig[event.type].color} variant="secondary">
                                {categoryConfig[event.type].name}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {format(event.date, viewMode === 'month' ? 'd/M' : 'd/M/yyyy')}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900">{event.name}</p>
                            {event.description && viewMode === 'month' && (
                              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{event.description}</p>
                            )}
                          </div>
                        ))
                      )
                    : (
                        <p className="py-4 text-center text-slate-500">
                          {t('noSpecialEvents')}
                          {viewMode === 'month' ? t('thisMonth') : t('thisYear')}
                        </p>
                      )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
