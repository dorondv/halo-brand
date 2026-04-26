'use client';

import type { Range, RangeKeyDict } from 'react-date-range';
import { endOfMonth, format, startOfMonth, startOfYear, subDays } from 'date-fns';
import { enUS as dfEnUS, he as dfHe } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, CalendarIcon, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { DateRangePicker as ReactDateRangePicker } from 'react-date-range';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/libs/cn';
import { clampDashboardDateRange, getDashboardDateBounds } from '@/libs/dashboardDateRangeLimits';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file

type DateRange = Range;
type DateRangeOption = 'last7' | 'last14' | 'last28' | 'lastMonth' | 'currentMonth' | 'currentYear' | 'custom';
type GranularityOption = 'day' | 'week' | 'month' | 'year';

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();
  const t = useTranslations('DashboardPage');
  const localeCode = useLocale();
  const isRTL = localeCode === 'he';
  const dfLocale = isRTL ? dfHe : dfEnUS;

  // Get current params
  const currentRange = (searchParams.get('range') || 'last7') as DateRangeOption;
  const currentGranularity = (searchParams.get('granularity') || 'day') as GranularityOption;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  // Calculate date range based on option
  const getDateRange = React.useCallback((range: DateRangeOption): DateRange => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (range) {
      case 'last7':
        return { startDate: subDays(today, 6), endDate: today, key: 'selection' };
      case 'last14':
        return { startDate: subDays(today, 13), endDate: today, key: 'selection' };
      case 'last28':
        return { startDate: subDays(today, 27), endDate: today, key: 'selection' };
      case 'lastMonth': {
        const lastMonth = subDays(startOfMonth(today), 1);
        return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth), key: 'selection' };
      }
      case 'currentMonth': {
        return { startDate: startOfMonth(today), endDate: today, key: 'selection' };
      }
      case 'currentYear': {
        return { startDate: startOfYear(today), endDate: today, key: 'selection' };
      }
      case 'custom':
        if (fromParam && toParam) {
          const clamped = clampDashboardDateRange(new Date(fromParam), new Date(toParam), today);
          return {
            startDate: clamped.from,
            endDate: clamped.to,
            key: 'selection',
          };
        }
        return { startDate: subDays(today, 6), endDate: today, key: 'selection' };
      default:
        return { startDate: subDays(today, 6), endDate: today, key: 'selection' };
    }
  }, [fromParam, toParam]);

  const [dateRange, setDateRange] = React.useState<DateRange[]>(() => [getDateRange(currentRange)]);
  const [showCustomCalendar, setShowCustomCalendar] = React.useState(false);
  const [showRangeOptions, setShowRangeOptions] = React.useState(false);
  const [showGranularityOptions, setShowGranularityOptions] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  const calendarBounds = getDashboardDateBounds();

  // Prevent hydration mismatch by only rendering Popovers after mount
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsMounted(true);
  }, []);

  // Update date range when params change
  React.useEffect(() => {
    const newRange = getDateRange(currentRange);
    const shouldShowCustom = currentRange === 'custom';

    // Only update if values actually changed
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setDateRange((prevRange) => {
      const prevFrom = prevRange[0]?.startDate?.getTime();
      const prevTo = prevRange[0]?.endDate?.getTime();
      const newFrom = newRange?.startDate?.getTime();
      const newTo = newRange?.endDate?.getTime();

      if (prevFrom !== newFrom || prevTo !== newTo) {
        return [newRange];
      }
      return prevRange;
    });

    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setShowCustomCalendar(prev => prev !== shouldShowCustom ? shouldShowCustom : prev);
  }, [currentRange, fromParam, toParam, getDateRange]);

  const updateURL = (range: DateRangeOption, granularity: GranularityOption, customRange?: DateRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    params.set('granularity', granularity);

    if (range === 'custom') {
      if (customRange?.startDate && customRange?.endDate) {
        params.set('from', format(customRange.startDate, 'yyyy-MM-dd'));
        params.set('to', format(customRange.endDate, 'yyyy-MM-dd'));
      }
      // Keep existing from/to in the URL when only granularity changes (no customRange passed).
    } else {
      params.delete('from');
      params.delete('to');
    }

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    const currentQuery = searchParams.toString();
    if (queryString === currentQuery) {
      return;
    }

    startTransition(() => {
      router.push(url, { scroll: false });
    });
  };

  const handleRangeSelect = (range: DateRangeOption) => {
    setShowRangeOptions(false);
    if (range === 'custom') {
      setShowCustomCalendar(true);
    } else {
      setShowCustomCalendar(false);
      updateURL(range, currentGranularity);
    }
  };

  const handleCustomDateSelect = (rangesByKey: RangeKeyDict) => {
    const newRange = rangesByKey.selection;
    if (newRange && newRange.startDate) {
      let start = newRange.startDate;
      let end = newRange.endDate ?? newRange.startDate;
      if (start < calendarBounds.earliestStart) {
        start = calendarBounds.earliestStart;
      }
      if (end > calendarBounds.todayEnd) {
        end = calendarBounds.todayEnd;
      }
      const working: DateRange = { ...newRange, startDate: start, endDate: end, key: 'selection' };
      setDateRange([working]);

      // Only update URL and close when range end differs from start (second click in calendar)
      const ws = working.startDate;
      const we = working.endDate;
      if (we && ws && ws.getTime() !== we.getTime()) {
        const clamped = clampDashboardDateRange(ws, we);
        updateURL('custom', currentGranularity, {
          ...working,
          startDate: clamped.from,
          endDate: clamped.to,
        });
        setDateRange([{ ...working, startDate: clamped.from, endDate: clamped.to }]);
        setShowCustomCalendar(false);
        setShowRangeOptions(false);
      }
    }
  };

  const handleGranularitySelect = (granularity: GranularityOption) => {
    setShowGranularityOptions(false);
    updateURL(currentRange, granularity);
  };

  const formatDateRange = (range: DateRange[]) => {
    if (!range[0]?.startDate) {
      return '';
    }
    const fromStr = format(range[0].startDate, 'dd/MM/yy', { locale: dfLocale });
    const toStr = range[0].endDate ? format(range[0].endDate, 'dd/MM/yy', { locale: dfLocale }) : fromStr;
    // RTL: show from-to, LTR: show to-from (reversed for Hebrew)
    return isRTL ? `${fromStr} - ${toStr}` : `${toStr} - ${fromStr}`;
  };

  const predefinedRanges = [
    { value: 'last7', label: t('date_range_last_7_days') },
    { value: 'last14', label: t('date_range_last_14_days') },
    { value: 'last28', label: t('date_range_last_28_days') },
    { value: 'lastMonth', label: t('date_range_last_month') },
    { value: 'currentMonth', label: t('date_range_current_month') },
    { value: 'currentYear', label: t('date_range_current_year') },
    { value: 'custom', label: t('date_range_custom') },
  ];

  const granularityOptions = [
    { value: 'day', label: t('granularity_day') },
    { value: 'week', label: t('granularity_week') },
    { value: 'month', label: t('granularity_month') },
    { value: 'year', label: t('granularity_year') },
  ];

  // For English: Label, Granularity, DatePicker
  // For Hebrew: DatePicker, Granularity, Label (then flex-row-reverse reverses it)
  const dateRangeSelector = isMounted
    ? (
        <Popover
          open={showRangeOptions || showCustomCalendar}
          onOpenChange={(open) => {
            // Only close if user explicitly closes or if range is complete
            if (!open) {
              setShowRangeOptions(false);
              // Don't auto-close custom calendar - let user select range
              if (currentRange !== 'custom' && !showCustomCalendar) {
                setShowCustomCalendar(false);
              }
            }
          }}
          modal={false}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'min-w-[200px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal transition-colors duration-200 ease-out hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700',
                isRTL ? 'flex-row-reverse' : '',
              )}
              onClick={() => {
                if (currentRange === 'custom') {
                  setShowCustomCalendar(true);
                } else {
                  setShowRangeOptions(true);
                }
              }}
            >
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-gray-700 dark:text-gray-200">{formatDateRange(dateRange)}</span>
                <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn('w-auto p-0 border-pink-200 dark:border-gray-700 dark:bg-gray-800', isRTL ? 'mr-0' : 'ml-0')}
            align={isRTL ? 'end' : 'start'}
            onInteractOutside={(e) => {
              // Prevent closing when clicking on calendar dates or navigation
              const target = e.target as HTMLElement;
              if (
                target.closest('.rdrCalendar')
                || target.closest('.rdrDay')
                || target.closest('.rdrMonths')
                || target.closest('.rdrNextPrevButton')
                || target.closest('.rdrMonth')
              ) {
                e.preventDefault();
              }
            }}
          >
            {!showCustomCalendar
              ? (
                  <div className="p-2">
                    {predefinedRanges.map(range => (
                      <Button
                        key={range.value}
                        variant="ghost"
                        className={cn(
                          'w-full justify-start mb-1 transition-colors duration-200 ease-out hover:bg-pink-50 dark:hover:bg-gray-700',
                          currentRange === range.value && 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
                          isRTL && 'text-right',
                        )}
                        onClick={() => handleRangeSelect(range.value as DateRangeOption)}
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>
                )
              : (
                  <div className="p-2">
                    <div className="mb-2 border-b border-pink-200 pb-2 dark:border-gray-600">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCustomCalendar(false);
                          setShowRangeOptions(true);
                        }}
                        className={cn(
                          'w-full text-pink-600 transition-colors duration-200 ease-out hover:bg-pink-50 dark:text-pink-400 dark:hover:bg-gray-700',
                          isRTL ? 'flex-row-reverse' : '',
                        )}
                      >
                        {isRTL ? <ArrowRight className="mr-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
                        {t('date_range_back_to_options')}
                      </Button>
                    </div>
                    <div dir={isRTL ? 'rtl' : 'ltr'}>
                      <ReactDateRangePicker
                        ranges={dateRange}
                        onChange={handleCustomDateSelect}
                        moveRangeOnFirstSelection={false}
                        months={2}
                        locale={dfLocale}
                        rangeColors={['#ec4899']}
                        weekdayDisplayFormat="EEEEE"
                        weekStartsOn={isRTL ? 6 : 0} // Sunday is 0, Saturday is 6
                        showDateDisplay={false}
                        direction="horizontal"
                        minDate={calendarBounds.earliestStart}
                        maxDate={calendarBounds.todayEnd}
                      />
                    </div>
                  </div>
                )}
          </PopoverContent>
        </Popover>
      )
    : (
        <Button
          variant="outline"
          className={cn(
            'min-w-[200px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal transition-colors duration-200 ease-out hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700',
            isRTL ? 'flex-row-reverse' : '',
          )}
          disabled
        >
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-gray-700 dark:text-gray-200">{formatDateRange(dateRange)}</span>
            <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
        </Button>
      );

  const granularitySelector = isMounted
    ? (
        <Popover open={showGranularityOptions} onOpenChange={setShowGranularityOptions}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'min-w-[120px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal transition-colors duration-200 ease-out hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700',
                isRTL ? 'flex-row-reverse' : '',
              )}
            >
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-gray-700 dark:text-gray-200">
                  {granularityOptions.find(g => g.value === currentGranularity)?.label}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn('w-auto p-2 dark:bg-gray-800 dark:border-gray-700', isRTL ? 'mr-0' : 'ml-0')}
            align={isRTL ? 'end' : 'start'}
          >
            {granularityOptions.map(option => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors duration-200 ease-out hover:bg-pink-50 dark:hover:bg-gray-700 dark:text-gray-200',
                  currentGranularity === option.value && 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
                  isRTL && 'text-right',
                )}
                onClick={() => handleGranularitySelect(option.value as GranularityOption)}
              >
                {option.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )
    : (
        <Button
          variant="outline"
          className={cn(
            'min-w-[120px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal transition-colors duration-200 ease-out hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700',
            isRTL ? 'flex-row-reverse' : '',
          )}
          disabled
        >
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-gray-700 dark:text-gray-200">
              {granularityOptions.find(g => g.value === currentGranularity)?.label}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
        </Button>
      );

  const label = <span className="text-sm text-gray-700 dark:text-gray-300">{t('date_range_display_by')}</span>;

  return (
    <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* For English: Label, Granularity, DatePicker */}
      {/* For Hebrew: DatePicker, Granularity, Label (flex-row-reverse reverses to Label, Granularity, DatePicker) */}
      {isRTL
        ? (
            <>
              {dateRangeSelector}
              {granularitySelector}
              {label}
            </>
          )
        : (
            <>
              {label}
              {granularitySelector}
              {dateRangeSelector}
            </>
          )}
    </div>
  );
}
