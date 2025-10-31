'use client';

import { format } from 'date-fns';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DataPoint = { date: string; rate: number };

const EMPTY_DATA: DataPoint[] = [];

export function EngagementRateChart({ data = EMPTY_DATA }: { data?: DataPoint[] }) {
  const formattedData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MMM. dd'),
  }));

  return (
    <div className="h-80 min-h-80 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
          <YAxis
            stroke="#be185d"
            fontSize={12}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
            tickFormatter={value => `${value.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #fce7f3',
              borderRadius: '12px',
            }}
            formatter={value => [`${Number(value).toFixed(1)}%`, '']}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#F50A81"
            strokeWidth={3}
            dot={{ r: 4, fill: '#F50A81' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EngagementRateChart;
