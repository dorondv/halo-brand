'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { he as dfHe, enUS as dfEnUS } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

import { cn } from '@/libs/cn';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useLocale } from 'next-intl';

export function DateRangePicker({
    className,
}: React.HTMLAttributes<HTMLDivElement>) {
    const localeCode = useLocale();
    const dfLocale = localeCode === 'he' ? dfHe : dfEnUS;
    const dir = localeCode === 'he' ? 'rtl' : 'ltr';
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: new Date(2022, 0, 20),
        to: addDays(new Date(2022, 0, 20), 20),
    });

    return (
        <div className={cn('grid gap-2', className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        id="date"
                        className={cn(
                            `h-12 w-[320px] rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-lg px-4 flex items-center justify-between text-sm ${dir === 'rtl' ? 'flex-row-reverse' : ''}`,
                            !date && 'text-muted-foreground',
                        )}
                    >
                        <span className={cn('truncate text-gray-900')}>
                            {date?.from ? (
                                date.to ? (
                                    <>
                                        {format(date.from, 'PPP', { locale: dfLocale })} -{' '}
                                        {format(date.to, 'PPP', { locale: dfLocale })}
                                    </>
                                ) : (
                                    format(date.from, 'PPP', { locale: dfLocale })
                                )
                            ) : (
                                <span>Pick a date</span>
                            )}
                        </span>
                        <CalendarIcon className="h-5 w-5 text-gray-500" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[720px] p-2 rounded-2xl border border-gray-200 shadow-xl" align={dir === 'rtl' ? 'start' : 'end'}>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        locale={dfLocale}
                        dir={dir as 'ltr' | 'rtl'}
                        classNames={{
                            caption: 'relative flex items-center justify-center px-6 pt-6',
                            caption_label: 'text-lg font-bold text-gray-900',
                            nav: 'absolute right-6 top-5 flex items-center gap-2',
                            nav_button: 'h-8 w-8 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                            nav_button_previous: '',
                            nav_button_next: '',
                            months: 'grid grid-cols-2 gap-10 p-6 items-start',
                            month: 'space-y-4',
                            day_selected: 'bg-gray-900 text-white rounded-lg hover:bg-gray-900',
                            day_range_middle: 'aria-selected:bg-gray-100 aria-selected:text-gray-900',
                            day_today: 'bg-gray-100 text-gray-900 rounded-lg',
                            head_row: 'flex',
                            head_cell: 'text-gray-500 rounded-md w-9 font-medium text-[0.8rem]',
                            row: 'flex w-full mt-3',
                            cell: 'h-9 w-9 text-center text-sm p-0 relative',
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
