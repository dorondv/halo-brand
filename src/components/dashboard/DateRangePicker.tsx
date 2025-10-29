'use client';

import type { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { enUS as dfEnUS, he as dfHe } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { useLocale } from 'next-intl';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/libs/cn';

export function DateRangePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const localeCode = useLocale();
  const dfLocale = localeCode === 'he' ? dfHe : dfEnUS;
  const dir = localeCode === 'he' ? 'rtl' : 'ltr';
  const [date, setDate] = React.useState<DateRange | undefined>(() => ({
    from: new Date(2022, 0, 20),
    to: addDays(new Date(2022, 0, 20), 20),
  }));

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'w-[300px] justify-start text-left font-normal',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from
              ? (
                  date.to
                    ? (
                        <>
                          {format(date.from, 'PPP', { locale: dfLocale })}
                          {' '}
                          -
                          {' '}
                          {format(date.to, 'PPP', { locale: dfLocale })}
                        </>
                      )
                    : (
                        format(date.from, 'PPP', { locale: dfLocale })
                      )
                )
              : (
                  <span>Pick a date</span>
                )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={dfLocale}
            dir={dir as 'ltr' | 'rtl'}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
