import { TrendingUp } from 'lucide-react';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/libs/cn';

type MetricCardProps = {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  vsLabel?: string;
  isSelected?: boolean;
};

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  vsLabel = 'vs last month',
  isSelected = false,
}: MetricCardProps): React.ReactElement {
  return (
    <Card className={cn(
      'group relative cursor-pointer rounded-lg bg-white shadow-md transition-transform hover:scale-105 w-full h-full',
      // Override base Card border styles when selected
      isSelected
        ? '!border-2 !border-pink-500 ring-2 ring-pink-100 shadow-lg'
        : 'border border-pink-100',
    )}
    >
      <CardContent className="flex h-full flex-1 flex-col p-4">
        <div className="flex flex-1 flex-col gap-3">
          {/* Icon positioned absolutely at top-right for LTR, top-left for RTL - with hover animation on card */}
          <div className="absolute top-3 right-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 shadow-lg transition-transform duration-300 group-hover:scale-110 rtl:right-auto rtl:left-3">
            <Icon className="h-6 w-6 text-white" />
          </div>

          {/* Title - left-aligned for LTR, right-aligned for RTL */}
          <div className="flex min-h-10 items-center pr-14 rtl:pr-0 rtl:pl-14">
            <p className="text-base font-medium text-gray-700">{title}</p>
          </div>

          {/* Value - left-aligned for LTR, right-aligned for RTL */}
          <div className="text-left text-3xl font-bold text-gray-900 rtl:text-right">{value}</div>

          {/* Comparison Text and Percentage - left-aligned for LTR, right-aligned for RTL */}
          <div className="mt-2 flex flex-row items-center gap-1.5 text-left rtl:flex-row-reverse rtl:justify-end rtl:text-right">
            <span className="flex items-center gap-1 text-sm font-medium text-pink-600 rtl:flex-row-reverse">
              {change >= 0 ? '+' : ''}
              {change.toFixed(1)}
              %
              <TrendingUp className="h-3 w-3 shrink-0" />
            </span>
            <span className="text-xs text-gray-400">{vsLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
