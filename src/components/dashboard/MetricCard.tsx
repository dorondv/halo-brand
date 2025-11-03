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
      'group relative cursor-pointer rounded-lg border bg-white shadow-md transition-transform hover:scale-105',
      isSelected ? 'border-[#FF0083] border-2' : 'border-pink-200',
    )}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Icon positioned absolutely at top-right for LTR, top-left for RTL - with hover animation on card */}
          <div className="absolute top-3 right-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#FF0083] transition-transform duration-200 group-hover:scale-110 rtl:right-auto rtl:left-3">
            <Icon className="h-6 w-6 text-white" />
          </div>

          {/* Title - left-aligned for LTR, right-aligned for RTL */}
          <div className="flex min-h-10 items-center pr-14 rtl:pr-0 rtl:pl-14">
            <p className="text-base font-medium text-gray-700">{title}</p>
          </div>

          {/* Value - left-aligned for LTR, right-aligned for RTL */}
          <div className="text-left text-3xl font-bold text-gray-900 rtl:text-right">{value}</div>

          {/* Comparison Text and Percentage - left-aligned for LTR, right-aligned for RTL */}
          <div className="flex flex-col gap-0.5 text-left rtl:text-right">
            <span className="text-xs text-gray-400">{vsLabel}</span>
            <span className="flex items-center gap-1 text-sm font-medium text-[#FF0083] rtl:flex-row-reverse">
              {change >= 0 ? '+' : ''}
              {change.toFixed(1)}
              %
              <TrendingUp className="h-3 w-3 shrink-0" />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
