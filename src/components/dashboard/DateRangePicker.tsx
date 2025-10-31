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
      updateURL('custom', currentGranularity);
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
  const dateRangeSelector = (
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
        {showCustomCalendar
          ? (
              <div className="p-4">
                <Button
                  variant="ghost"
                  className={cn(
                    'mb-4 w-full justify-start text-sm text-gray-600 hover:text-gray-900',
                    isRTL ? 'flex-row-reverse' : '',
                  )}
                  onClick={() => {
                    setShowCustomCalendar(false);
                    setShowRangeOptions(true);
                  }}
                >
                  {isRTL ? <ArrowRight className="mr-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
                  {t('date_range_back_to_options')}
                </Button>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleCustomDateSelect}
                  numberOfMonths={2}
                  locale={dfLocale}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
            )
          : (
              <div className="p-2">
                {predefinedRanges.map(range => (
                  <button
                    key={range.value}
                    type="button"
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-pink-50',
                      currentRange === range.value && 'bg-pink-50 text-pink-600',
                      isRTL && 'text-right',
                    )}
                    onClick={() => handleRangeSelect(range.value as DateRangeOption)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            )}
      </PopoverContent>
    </Popover>
  );

  const granularitySelector = (
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
