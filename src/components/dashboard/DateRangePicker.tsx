'use client';

import type { DateRange } from 'react-day-picker';
import { endOfMonth, format, startOfMonth, subDays } from 'date-fns';
import { enUS as dfEnUS, he as dfHe } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, CalendarIcon, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/libs/cn';

type DateRangeOption = 'last7' | 'last14' | 'last28' | 'lastMonth' | 'custom';
type GranularityOption = 'day' | 'week' | 'month' | 'year';

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
        return { from: subDays(today, 6), to: today };
      case 'last14':
        return { from: subDays(today, 13), to: today };
      case 'last28':
        return { from: subDays(today, 27), to: today };
      case 'lastMonth': {
        const lastMonth = subDays(startOfMonth(today), 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      }
      case 'custom':
        if (fromParam && toParam) {
          return {
            from: new Date(fromParam),
            to: new Date(toParam),
          };
        }
        return { from: subDays(today, 6), to: today };
      default:
        return { from: subDays(today, 6), to: today };
    }
  }, [fromParam, toParam]);

  const [dateRange, setDateRange] = React.useState<DateRange>(() => getDateRange(currentRange));
  const [showCustomCalendar, setShowCustomCalendar] = React.useState(false);
  const [showRangeOptions, setShowRangeOptions] = React.useState(false);
  const [showGranularityOptions, setShowGranularityOptions] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

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
      const prevFrom = prevRange?.from?.getTime();
      const prevTo = prevRange?.to?.getTime();
      const newFrom = newRange?.from?.getTime();
      const newTo = newRange?.to?.getTime();

      if (prevFrom !== newFrom || prevTo !== newTo) {
        return newRange;
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

    if (range === 'custom' && customRange?.from && customRange?.to) {
      params.set('from', format(customRange.from, 'yyyy-MM-dd'));
      params.set('to', format(customRange.to, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
      params.delete('to');
    }

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url, { scroll: false });
    router.refresh();
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

  const handleCustomDateSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
      updateURL('custom', currentGranularity, range);
      setShowCustomCalendar(false);
      setShowRangeOptions(false);
    } else if (range) {
      setDateRange(range);
    }
  };

  const handleGranularitySelect = (granularity: GranularityOption) => {
    setShowGranularityOptions(false);
    updateURL(currentRange, granularity);
  };

  const formatDateRange = (range: DateRange) => {
    if (!range.from) {
      return '';
    }
    const fromStr = format(range.from, 'dd/MM/yy', { locale: dfLocale });
    const toStr = range.to ? format(range.to, 'dd/MM/yy', { locale: dfLocale }) : fromStr;
    // RTL: show from-to, LTR: show to-from (reversed for Hebrew)
    return isRTL ? `${fromStr} - ${toStr}` : `${toStr} - ${fromStr}`;
  };

  const predefinedRanges = [
    { value: 'last7', label: t('date_range_last_7_days') },
    { value: 'last14', label: t('date_range_last_14_days') },
    { value: 'last28', label: t('date_range_last_28_days') },
    { value: 'lastMonth', label: t('date_range_last_month') },
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
            if (!open) {
              setShowRangeOptions(false);
              if (currentRange !== 'custom') {
                setShowCustomCalendar(false);
              }
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'min-w-[200px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal hover:bg-gray-50',
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
                <span className="text-gray-700">{formatDateRange(dateRange)}</span>
                <CalendarIcon className="h-4 w-4 text-gray-500" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn('w-auto p-0', isRTL ? 'mr-0' : 'ml-0')}
            align={isRTL ? 'end' : 'start'}
          >
            {!showCustomCalendar
              ? (
                  <div className="p-2">
                    {predefinedRanges.map(range => (
                      <Button
                        key={range.value}
                        variant="ghost"
                        className={cn(
                          'w-full justify-start mb-1 hover:bg-pink-50',
                          currentRange === range.value && 'bg-pink-50 text-pink-600',
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
                    <div className="mb-2 border-b pb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCustomCalendar(false);
                          setShowRangeOptions(true);
                        }}
                        className={cn(
                          'w-full text-pink-600 hover:bg-pink-50',
                          isRTL ? 'flex-row-reverse' : '',
                        )}
                      >
                        {isRTL ? <ArrowRight className="mr-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
                        {t('date_range_back_to_options')}
                      </Button>
                    </div>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={handleCustomDateSelect}
                      numberOfMonths={2}
                      locale={dfLocale}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      className="rounded-md"
                      classNames={{
                        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                        month: 'space-y-4',
                        caption: 'flex justify-center pt-1 relative items-center',
                        caption_label: 'text-sm font-medium',
                        nav: 'space-x-1 flex items-center',
                        nav_button: cn(
                          'h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-gray-100 rounded-md transition-colors',
                        ),
                        nav_button_previous: 'absolute left-2 top-1',
                        nav_button_next: 'absolute right-2 top-1',
                        table: 'w-full border-collapse space-y-1',
                        head_row: 'flex',
                        head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
                        row: 'flex w-full mt-2',
                        cell: cn(
                          'h-9 w-9 text-center text-sm p-0 relative',
                          '[&:has([aria-selected].day-range-end)]:rounded-r-md',
                          '[&:has([aria-selected].day-range-start)]:rounded-l-md',
                          '[&:has([aria-selected])]:bg-pink-100',
                          'first:[&:has([aria-selected])]:rounded-l-md',
                          'last:[&:has([aria-selected])]:rounded-r-md',
                          'focus-within:relative focus-within:z-20',
                        ),
                        day: cn(
                          'h-9 w-9 p-0 font-normal',
                          'aria-selected:opacity-100',
                          'hover:bg-gray-100 hover:text-gray-900',
                          'focus:bg-gray-100 focus:text-gray-900',
                        ),
                        day_range_start: 'rounded-l-md bg-pink-500 text-white hover:bg-pink-600 focus:bg-pink-600 font-semibold',
                        day_range_end: 'rounded-r-md bg-pink-500 text-white hover:bg-pink-600 focus:bg-pink-600 font-semibold',
                        day_selected: 'bg-pink-500 text-white hover:bg-pink-600 focus:bg-pink-600 font-semibold rounded-md',
                        day_today: 'bg-gray-100 text-gray-900 font-semibold',
                        day_outside: 'text-gray-400 opacity-50',
                        day_disabled: 'text-gray-300 opacity-30 cursor-not-allowed',
                        day_range_middle: 'bg-pink-100 text-gray-900 hover:bg-pink-200 aria-selected:bg-pink-100 aria-selected:text-gray-900',
                        day_hidden: 'invisible',
                      }}
                    />
                  </div>
                )}
          </PopoverContent>
        </Popover>
      )
    : (
        <Button
          variant="outline"
          className={cn(
            'min-w-[200px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal hover:bg-gray-50',
            isRTL ? 'flex-row-reverse' : '',
          )}
          disabled
        >
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-gray-700">{formatDateRange(dateRange)}</span>
            <CalendarIcon className="h-4 w-4 text-gray-500" />
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
                'min-w-[120px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal hover:bg-gray-50',
                isRTL ? 'flex-row-reverse' : '',
              )}
            >
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-gray-700">
                  {granularityOptions.find(g => g.value === currentGranularity)?.label}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn('w-auto p-2', isRTL ? 'mr-0' : 'ml-0')}
            align={isRTL ? 'end' : 'start'}
          >
            {granularityOptions.map(option => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-pink-50',
                  currentGranularity === option.value && 'bg-pink-50 text-pink-600',
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
            'min-w-[120px] justify-between rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-normal hover:bg-gray-50',
            isRTL ? 'flex-row-reverse' : '',
          )}
          disabled
        >
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-gray-700">
              {granularityOptions.find(g => g.value === currentGranularity)?.label}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </div>
        </Button>
      );

  const label = <span className="text-sm text-gray-700">{t('date_range_display_by')}</span>;

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
