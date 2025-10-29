import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/utils/number-format';

type MetricCardProps = {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
};

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
}: MetricCardProps): React.ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatNumber(value)}</div>
        <p className="text-xs text-slate-500">
          <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}
            %
          </span>
          {' '}
          from last month
        </p>
      </CardContent>
    </Card>
  );
}
